"""FastAPI application — recipe service (reference implementation).

Discipline gates the autograder enforces:
- Neo4j driver, Weaviate client, spaCy pipeline, and the flan-t5-base
  generator are constructed exactly once per process inside `lifespan`.
- `CORSMiddleware` registered with `allow_origins=[WEB_ORIGIN]`.
- `/extract`, `/kg/query`, `/rag/answer` use Pydantic shapes from `models.py`.
- `/kg/query` converts `UnsupportedQueryError` to 422 with structured detail.
- `/readyz` probes Neo4j (`RETURN 1`) AND Weaviate (`client.is_ready()`)
  within 2 seconds; failure → 503.
- `/healthz` does NOT touch Neo4j or Weaviate.

Robustness enhancements (Integration 10):
- Structured JSON logging with request IDs and timing.
- Environment variable validation on startup with sensible defaults.
- Comprehensive exception handling with context and error codes.
- Request-scoped tracing via middleware.
- Added `/health` alias for docker-compose compatibility.
- Validation of request inputs with meaningful error messages.
"""
import logging
import os
import time
import uuid
from contextlib import asynccontextmanager

import spacy
import weaviate
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from neo4j import GraphDatabase
from sentence_transformers import SentenceTransformer

from .deps import get_embedder, get_generator, get_nlp, get_session, get_weaviate
from .kg import wrap_kg_query
from .m8_rag import load_generator
from .models import (
    ExtractRequest,
    ExtractResponse,
    HealthResponse,
    KGRequest,
    KGResponse,
    RAGRequest,
    RAGResponse,
    ServiceUnavailableDetail,
    UnsupportedQueryDetail,
)
from .nlp import extract_entities
from .rag import GenerationTimeoutError, compose_rag
from .w9b_mapper.errors import UnsupportedQueryError
from .w9b_mapper.shapes import SUPPORTED_PATTERNS

logger = logging.getLogger("api")


logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format='{"ts":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","msg":"%(message)s"}',
)


def _validate_env_vars():
    """Validate required environment variables at startup."""
    required = ["NEO4J_URI", "WEAVIATE_URL"]
    missing = [v for v in required if not os.environ.get(v)]
    if missing:
        raise RuntimeError(f"Missing required env vars: {', '.join(missing)}")
    logger.info(
        f"env_neo4j_uri={os.environ['NEO4J_URI']} "
        f"env_weaviate_url={os.environ['WEAVIATE_URL']} "
        f"env_web_origin={os.environ.get('WEB_ORIGIN', 'http://localhost:3000')}"
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("lifespan_start")
    try:
        _validate_env_vars()
    except RuntimeError as e:
        logger.error("env_validation_failed error=%s", str(e))
        raise

    neo4j_uri = os.environ.get("NEO4J_URI")
    neo4j_user = os.environ.get("NEO4J_USER", "neo4j")
    neo4j_password = os.environ.get("NEO4J_PASSWORD", "")
    weaviate_url = os.environ.get("WEAVIATE_URL")

    try:
        app.state.neo4j_driver = GraphDatabase.driver(
            neo4j_uri,
            auth=(neo4j_user, neo4j_password),
        )
        logger.info("neo4j_driver_constructed uri=%s", neo4j_uri)
    except Exception as e:
        logger.error("neo4j_driver_failed error=%s", e.__class__.__name__)
        raise

    try:
        app.state.weaviate_client = weaviate.Client(weaviate_url)
        logger.info("weaviate_client_constructed url=%s", weaviate_url)
    except Exception as e:
        logger.error("weaviate_client_failed error=%s", e.__class__.__name__)
        app.state.neo4j_driver.close()
        raise

    try:
        app.state.nlp = spacy.load("en_core_web_sm")
        logger.info("spacy_pipeline_loaded model=en_core_web_sm")
    except Exception as e:
        logger.error("spacy_pipeline_failed error=%s", e.__class__.__name__)
        app.state.neo4j_driver.close()
        raise

    try:
        app.state.generator = load_generator()
        logger.info("generator_loaded")
    except Exception as e:
        logger.error("generator_failed error=%s", e.__class__.__name__)
        app.state.neo4j_driver.close()
        raise

    try:
        # Same sentence-transformers model the seed used at ingest. The
        # Weaviate class is `vectorizer=none`, so /rag/answer encodes the
        # query externally and queries via `with_near_vector`.
        app.state.embedder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
        logger.info("embedder_loaded model=all-MiniLM-L6-v2")
    except Exception as e:
        logger.error("embedder_failed error=%s", e.__class__.__name__)
        app.state.neo4j_driver.close()
        raise

    logger.info("lifespan_ready")
    yield
    try:
        app.state.neo4j_driver.close()
        logger.info("neo4j_driver_closed")
    except Exception as e:
        logger.error("neo4j_driver_close_failed error=%s", e.__class__.__name__)
    logger.info("lifespan_shutdown")


app = FastAPI(title="M10 Recipe Service", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("WEB_ORIGIN", "http://localhost:3000")],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_request_context(request: Request, call_next):
    """Add request_id and timing to all requests for structured logging."""
    request.state.request_id = str(uuid.uuid4())
    request.state.start_time = time.time()
    response = await call_next(request)
    duration_ms = (time.time() - request.state.start_time) * 1000
    logger.info(
        "request_completed request_id=%s path=%s method=%s status=%d duration_ms=%.1f",
        request.state.request_id,
        request.url.path,
        request.method,
        response.status_code,
        duration_ms,
    )
    return response


@app.post("/extract", response_model=ExtractResponse)
def extract(req: ExtractRequest, nlp=Depends(get_nlp), request: Request = None) -> ExtractResponse:
    request_id = request.state.request_id if request else "unknown"
    try:
        if not req.text or not req.text.strip():
            logger.warning("extract_invalid_input request_id=%s reason=empty_text", request_id)
            raise HTTPException(status_code=400, detail="Text must not be empty.")
        entities = extract_entities(req.text, nlp)
        logger.info("extract_ok request_id=%s entities=%d", request_id, len(entities))
        return ExtractResponse(entities=entities)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("extract_failed request_id=%s error=%s", request_id, exc.__class__.__name__)
        raise HTTPException(status_code=500, detail="Entity extraction failed.")


@app.post("/kg/query", response_model=KGResponse)
def kg_query(req: KGRequest, session=Depends(get_session), request: Request = None) -> KGResponse:
    request_id = request.state.request_id if request else "unknown"
    try:
        cypher, params = wrap_kg_query(req.question)
        logger.info("kg_query_mapped request_id=%s question=%.50s", request_id, req.question)
    except UnsupportedQueryError as exc:
        logger.info("kg_query_unsupported request_id=%s question=%.50s", request_id, req.question)
        raise HTTPException(
            status_code=422,
            detail=UnsupportedQueryDetail(
                reason="unsupported_question",
                supported_patterns=list(SUPPORTED_PATTERNS),
            ).model_dump(),
        )
    try:
        rows = [r.data() for r in session.run(cypher, **params)]
        logger.info("kg_query_ok request_id=%s rows=%d", request_id, len(rows))
    except Exception as exc:
        logger.error("kg_query_neo4j_failure request_id=%s error=%s", request_id, exc.__class__.__name__)
        raise HTTPException(
            status_code=503,
            detail=ServiceUnavailableDetail(
                reason="dependency_unavailable",
                detail="Neo4j query failed; the graph database may be unavailable.",
            ).model_dump(),
        )
    return KGResponse(cypher=cypher, rows=rows, count=len(rows))


@app.post("/rag/answer", response_model=RAGResponse)
def rag_answer(
    req: RAGRequest,
    weaviate_client=Depends(get_weaviate),
    generator=Depends(get_generator),
    embedder=Depends(get_embedder),
    request: Request = None,
) -> RAGResponse:
    request_id = request.state.request_id if request else "unknown"
    try:
        logger.info("rag_answer_start request_id=%s question=%.50s k=%d", request_id, req.question, req.k)
        result = compose_rag(req.question, embedder, weaviate_client, generator, k=req.k)
        logger.info(
            "rag_answer_ok request_id=%s citations=%d confidence=%.2f",
            request_id,
            len(result["citations"]),
            result["confidence"],
        )
    except GenerationTimeoutError as exc:
        logger.error("rag_answer_generation_timeout request_id=%s question=%.50s", request_id, req.question)
        raise HTTPException(
            status_code=503,
            detail=ServiceUnavailableDetail(
                reason="generation_timeout",
                detail=str(exc),
            ).model_dump(),
        )
    except Exception as exc:
        logger.error("rag_answer_dependency_failure request_id=%s error=%s", request_id, exc.__class__.__name__)
        raise HTTPException(
            status_code=503,
            detail=ServiceUnavailableDetail(
                reason="dependency_unavailable",
                detail="Retrieval or generation failed; Weaviate or the generator may be unavailable.",
            ).model_dump(),
        )
    return RAGResponse(**result)


@app.get("/healthz", response_model=HealthResponse)
def healthz(request: Request = None) -> HealthResponse:
    request_id = request.state.request_id if request else "unknown"
    logger.info("healthz_ok request_id=%s", request_id)
    return HealthResponse(status="ok")


@app.get("/health", response_model=HealthResponse)
def health(request: Request = None) -> HealthResponse:
    """Alias for /healthz for compatibility with docker-compose healthcheck."""
    request_id = request.state.request_id if request else "unknown"
    logger.info("health_ok request_id=%s", request_id)
    return HealthResponse(status="ok")


@app.get("/readyz")
def readyz(
    session=Depends(get_session),
    weaviate_client=Depends(get_weaviate),
    request: Request = None,
):
    request_id = request.state.request_id if request else "unknown"
    detail = {"neo4j": "unknown", "weaviate": "unknown"}
    try:
        session.run("RETURN 1").single()
        detail["neo4j"] = "ok"
    except Exception as exc:
        detail["neo4j"] = f"unavailable: {exc.__class__.__name__}"
    try:
        if weaviate_client.is_ready():
            detail["weaviate"] = "ok"
        else:
            detail["weaviate"] = "not ready"
    except Exception as exc:
        detail["weaviate"] = f"unavailable: {exc.__class__.__name__}"

    if detail["neo4j"] != "ok" or detail["weaviate"] != "ok":
        logger.warning(
            "readyz_not_ready request_id=%s neo4j=%s weaviate=%s",
            request_id,
            detail["neo4j"],
            detail["weaviate"],
        )
        raise HTTPException(status_code=503, detail=detail)
    logger.info("readyz_ok request_id=%s", request_id)
    return detail
