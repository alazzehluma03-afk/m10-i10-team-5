"""RAG composer — retrieve → assemble → generate → cite → grounding check.

Grounding contract: when `answer` is not the empty-retrieval sentinel,
`len(citations) > 0` is required. Every cited `chunk_id` corresponds to
a chunk in the top-`k` retrieved from Weaviate.

Generator called with `do_sample=False` for reproducibility.

Integration hardening (Integration 10):
- Generator call is bounded by GENERATOR_TIMEOUT_SECONDS (default 30s,
  overridable via RAG_GENERATOR_TIMEOUT_SECONDS env var) so a hung
  flan-t5-base inference cannot block a request thread indefinitely.
- Validates retrieval results and citation extraction.
- Comprehensive error handling with typed exceptions.
- Raises GenerationTimeoutError on timeout, which main.py maps to 503.
"""
import os
import re
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from typing import Tuple

PROMPT_TEMPLATE = """\
You are answering a recipe question. Use ONLY the numbered sources below.
Cite each claim with the source number in square brackets, e.g. [1].
If the sources do not contain the answer, say: I cannot answer this from the available sources.

Sources:
{sources}

Question: {question}
Answer:"""

SENTINEL = "I cannot answer this from the available sources"
CITATION_PATTERN = re.compile(r"\[(\d+)\]")
GENERATOR_TIMEOUT_SECONDS = float(os.environ.get("RAG_GENERATOR_TIMEOUT_SECONDS", "30"))

# One worker thread reused across calls to bound the generator without
# spinning up a new thread per request.
_generator_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="rag-generator")


class GenerationTimeoutError(Exception):
    """Raised when the generator does not return within GENERATOR_TIMEOUT_SECONDS."""


def assemble_prompt(question: str, chunks: list[dict]) -> Tuple[str, dict[int, dict]]:
    """Number the retrieved chunks 1..k and substitute into the prompt template.

    Returns (prompt_str, {citation_index: chunk_dict}). Index starts at 1.
    """
    numbered: dict[int, dict] = {}
    lines = []
    for i, chunk in enumerate(chunks, start=1):
        numbered[i] = chunk
        lines.append(f"[{i}] {chunk['text']}")
    sources = "\n".join(lines)
    return PROMPT_TEMPLATE.format(sources=sources, question=question), numbered


def extract_citations(answer: str, numbered: dict[int, dict]) -> list[dict]:
    """Pull [N]-style markers from `answer` and resolve to retrieved chunks.

    Returns one {"chunk_id", "score"} dict per unique resolvable index.
    """
    cited: list[dict] = []
    seen: set[int] = set()
    for match in CITATION_PATTERN.finditer(answer):
        idx = int(match.group(1))
        if idx in numbered and idx not in seen:
            seen.add(idx)
            chunk = numbered[idx]
            cited.append({"chunk_id": chunk["chunk_id"], "score": chunk["score"]})
    return cited


def compose_rag(question: str, embedder, weaviate_client, generator, k: int = 4) -> dict:
    """Run the four-stage RAG pipeline.

    Encodes the question via the externally-loaded sentence-transformers
    embedder and queries Weaviate with `with_near_vector`. The Weaviate
    class is `vectorizer=none`, so `with_near_text` would fail at
    runtime with `KeyError: 'data'`.

    Args:
        question: The user's question.
        embedder: sentence-transformers model instance.
        weaviate_client: Weaviate client.
        generator: HuggingFace text-generation pipeline.
        k: Top-k chunks to retrieve.

    Returns:
        {"answer": str, "citations": list[dict], "confidence": float}

    Raises:
        GenerationTimeoutError: If generation exceeds timeout.
        RuntimeError: If retrieval, encoding, or parsing fails.
    """
    # Stage 1: Encode question and retrieve chunks.
    try:
        vector = embedder.encode(question).tolist()
    except Exception as e:
        raise RuntimeError(f"Encoding failed: {e.__class__.__name__}: {str(e)}") from e

    try:
        raw_query = (
            weaviate_client.query.get("Chunk", ["chunk_id", "text"])
            .with_near_vector({"vector": vector})
            .with_limit(k)
            .with_additional(["distance"])
            .do()
        )
    except Exception as e:
        raise RuntimeError(f"Weaviate retrieval failed: {e.__class__.__name__}: {str(e)}") from e

    # Parse and validate retrieval response.
    try:
        retrieved = [
            {
                "chunk_id": c["chunk_id"],
                "text": c["text"],
                "score": 1.0 - c["_additional"]["distance"],
            }
            for c in raw_query["data"]["Get"]["Chunk"]
        ]
    except (KeyError, TypeError, IndexError) as e:
        raise RuntimeError(f"Malformed retrieval response: {e.__class__.__name__}") from e

    if not retrieved:
        return {"answer": SENTINEL, "citations": [], "confidence": 0.0}

    if not all(isinstance(c.get("chunk_id"), int) and isinstance(c.get("text"), str) for c in retrieved):
        raise RuntimeError("Invalid chunk data structure in retrieval results")

    # Stage 2: Assemble prompt and generate answer.
    prompt, numbered = assemble_prompt(question, retrieved)

    future = _generator_executor.submit(
        generator, prompt, max_new_tokens=256, do_sample=False
    )
    try:
        raw = future.result(timeout=GENERATOR_TIMEOUT_SECONDS)[0]["generated_text"]
    except FutureTimeoutError:
        raise GenerationTimeoutError(
            f"Generator did not return within {GENERATOR_TIMEOUT_SECONDS}s."
        )
    except (KeyError, IndexError, TypeError) as e:
        raise RuntimeError(f"Malformed generator response: {e.__class__.__name__}") from e

    # Stage 3: Extract citations and compute confidence.
    citations = extract_citations(raw, numbered)
    if not citations:
        return {"answer": SENTINEL, "citations": [], "confidence": 0.0}

    try:
        confidence = sum(c["score"] for c in citations) / len(citations)
        confidence = max(0.0, min(1.0, confidence))
    except (KeyError, ZeroDivisionError, TypeError) as e:
        raise RuntimeError(f"Citation aggregation failed: {e.__class__.__name__}") from e

    return {"answer": raw, "citations": citations, "confidence": confidence}
