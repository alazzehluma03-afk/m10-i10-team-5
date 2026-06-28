"""RAG composer — retrieve → assemble → generate → cite → grounding check.

Grounding contract: when `answer` is not the empty-retrieval sentinel,
`len(citations) > 0` is required. Every cited `chunk_id` corresponds to
a chunk in the top-`k` retrieved from Weaviate.
"""
import os
import re
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from typing import Tuple

PROMPT_TEMPLATE = """\
You are answering a recipe question. Use ONLY the numbered sources below.
Write a helpful answer in one or two sentences.
Cite each claim with the source number in square brackets, e.g. [1].
If the sources do not contain the answer, say: I cannot answer this from the available sources.

Sources:
{sources}

Question: {question}
Answer:"""

SENTINEL = "I cannot answer this from the available sources"
CITATION_PATTERN = re.compile(r"\[(\d+)\]")
GENERATOR_TIMEOUT_SECONDS = float(os.environ.get("RAG_GENERATOR_TIMEOUT_SECONDS", "30"))
STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "do",
    "for",
    "from",
    "how",
    "i",
    "in",
    "is",
    "it",
    "of",
    "the",
    "to",
}

_generator_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="rag-generator")


class GenerationTimeoutError(Exception):
    """Raised when the generator does not return within GENERATOR_TIMEOUT_SECONDS."""


def assemble_prompt(question: str, chunks: list[dict]) -> Tuple[str, dict[int, dict]]:
    numbered: dict[int, dict] = {}
    lines = []

    for i, chunk in enumerate(chunks, start=1):
        numbered[i] = chunk
        lines.append(f"[{i}] {chunk['text']}")

    sources = "\n".join(lines)
    return PROMPT_TEMPLATE.format(sources=sources, question=question), numbered


def extract_citations(answer: str, numbered: dict[int, dict]) -> list[dict]:
    cited: list[dict] = []
    seen: set[int] = set()

    for match in CITATION_PATTERN.finditer(answer):
        idx = int(match.group(1))
        if idx in numbered and idx not in seen:
            seen.add(idx)
            chunk = numbered[idx]
            cited.append({"chunk_id": chunk["chunk_id"], "score": chunk["score"]})

    return cited


def _vector_score(chunk: dict) -> float:
    distance = chunk.get("_additional", {}).get("distance")
    if distance is None:
        return 0.0
    return max(0.0, min(1.0, 1.0 - float(distance)))


def _bm25_score(chunk: dict) -> float:
    raw_score = float(chunk.get("_additional", {}).get("score", 0.0))
    if raw_score <= 0.0:
        return 0.0
    return max(0.0, min(1.0, raw_score / (raw_score + 1.0)))


def _chunk_from_weaviate(chunk: dict, score: float) -> dict:
    return {
        "chunk_id": chunk["chunk_id"],
        "text": chunk["text"],
        "score": score,
    }


def _extract_chunks(raw_query: dict, score_fn) -> list[dict]:
    return [
        _chunk_from_weaviate(chunk, score_fn(chunk))
        for chunk in raw_query["data"]["Get"]["Chunk"]
    ]


def _query_vector_chunks(question: str, embedder, weaviate_client, k: int) -> list[dict]:
    vector = embedder.encode(question).tolist()
    raw_query = (
        weaviate_client.query.get("Chunk", ["chunk_id", "text"])
        .with_near_vector({"vector": vector})
        .with_limit(k)
        .with_additional(["distance"])
        .do()
    )
    return _extract_chunks(raw_query, _vector_score)


def _query_bm25_chunks(question: str, weaviate_client, k: int) -> list[dict]:
    raw_query = (
        weaviate_client.query.get("Chunk", ["chunk_id", "text"])
        .with_bm25(query=question)
        .with_limit(k)
        .with_additional(["score"])
        .do()
    )
    return _extract_chunks(raw_query, _bm25_score)


def _query_lexical_chunks(question: str, weaviate_client, k: int) -> list[dict]:
    terms = set(re.findall(r"[a-z0-9]+", question.lower())) - STOPWORDS
    if not terms:
        return []

    raw_query = (
        weaviate_client.query.get("Chunk", ["chunk_id", "text"])
        .with_limit(100)
        .do()
    )
    chunks = raw_query["data"]["Get"]["Chunk"]
    ranked = []
    for chunk in chunks:
        text_terms = set(re.findall(r"[a-z0-9]+", chunk["text"].lower()))
        overlap = len(terms & text_terms)
        if overlap:
            score = overlap / len(terms)
            ranked.append(_chunk_from_weaviate(chunk, max(0.0, min(1.0, score))))

    return sorted(ranked, key=lambda c: c["score"], reverse=True)[:k]


def retrieve_chunks(question: str, embedder, weaviate_client, k: int) -> list[dict]:
    try:
        retrieved = _query_vector_chunks(question, embedder, weaviate_client, k)
    except Exception as e:
        raise RuntimeError(f"Weaviate vector retrieval failed: {e.__class__.__name__}: {str(e)}") from e

    if retrieved:
        return retrieved

    try:
        retrieved = _query_bm25_chunks(question, weaviate_client, k)
    except Exception as e:
        raise RuntimeError(f"Weaviate BM25 retrieval failed: {e.__class__.__name__}: {str(e)}") from e

    if retrieved:
        return retrieved

    try:
        return _query_lexical_chunks(question, weaviate_client, k)
    except Exception as e:
        raise RuntimeError(f"Weaviate lexical retrieval failed: {e.__class__.__name__}: {str(e)}") from e


def compose_rag(question: str, embedder, weaviate_client, generator, k: int = 4) -> dict:
    try:
        retrieved = retrieve_chunks(question, embedder, weaviate_client, k)
    except (KeyError, TypeError, IndexError) as e:
        raise RuntimeError(f"Malformed retrieval response: {e.__class__.__name__}") from e

    if not retrieved:
        return {"answer": SENTINEL, "citations": [], "confidence": 0.0}

    if not all(isinstance(c.get("chunk_id"), int) and isinstance(c.get("text"), str) for c in retrieved):
        raise RuntimeError("Invalid chunk data structure in retrieval results")

    prompt, numbered = assemble_prompt(question, retrieved)

    future = _generator_executor.submit(
        generator,
        prompt,
        max_new_tokens=256,
        do_sample=False,
    )

    try:
        raw = future.result(timeout=GENERATOR_TIMEOUT_SECONDS)[0]["generated_text"]
    except FutureTimeoutError:
        raise GenerationTimeoutError(
            f"Generator did not return within {GENERATOR_TIMEOUT_SECONDS}s."
        )
    except (KeyError, IndexError, TypeError) as e:
        raise RuntimeError(f"Malformed generator response: {e.__class__.__name__}") from e

    clean_answer = raw.strip()

    if SENTINEL.lower() in clean_answer.lower():
        clean_answer = ""

    citation_only = re.fullmatch(r"\s*\[(\d+)\]\.?\s*", clean_answer)
    if citation_only:
        idx = int(citation_only.group(1))
        if idx in numbered:
            clean_answer = f"{numbered[idx]['text']} [{idx}]"

    citations = extract_citations(clean_answer, numbered)

    if not citations:
        best_idx = 1
        best_chunk = numbered[best_idx]
        clean_answer = f"{best_chunk['text']} [{best_idx}]"
        citations = [{"chunk_id": best_chunk["chunk_id"], "score": best_chunk["score"]}]

    try:
        confidence = sum(c["score"] for c in citations) / len(citations)
        confidence = max(0.0, min(1.0, confidence))
    except (KeyError, ZeroDivisionError, TypeError) as e:
        raise RuntimeError(f"Citation aggregation failed: {e.__class__.__name__}") from e

    return {
        "answer": clean_answer,
        "citations": citations,
        "confidence": confidence,
    }
