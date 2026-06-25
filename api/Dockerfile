# Build context: repo root (parent of api/).
# In docker-compose.yml:  build: { context: ., dockerfile: api/Dockerfile }
#
# This preserves package-relative imports (api/main.py: from .deps import ...).
# Running `uvicorn api.main:app` from /app loads the `api` package; running
# `uvicorn main:app` from /app/api would break the relative imports with
# `ImportError: attempted relative import with no known parent package`.
#
# Cache optimization (Integration 10):
# - Copy requirements first so dependency layer caches independently of code.
# - Combine pip install calls where possible.
# - Use --no-cache-dir to reduce layer size.

FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install dependencies in a separate layer
# for better cache reuse when application code changes.
COPY api/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --timeout 300 --retries 5 -r /app/requirements.txt

# Install spaCy model with pinned URL to bypass compatibility resolver issues.
# en_core_web_sm 3.7.1 is compatible with spaCy 3.7.x from requirements.
RUN pip install --no-cache-dir --timeout 300 --retries 5 \
    https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.7.1/en_core_web_sm-3.7.1-py3-none-any.whl

# Copy application code last so code changes don't invalidate dependency layers.
COPY api/ /app/api/

EXPOSE 8000

# LOG_LEVEL and RAG_GENERATOR_TIMEOUT_SECONDS are optional Integration
# hardening env vars (see api/main.py, api/rag.py) — both have safe
# defaults (INFO, 30s) so no docker-compose.yml change is required.
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
