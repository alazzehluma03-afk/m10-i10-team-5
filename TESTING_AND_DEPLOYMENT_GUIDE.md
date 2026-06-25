# Backend API Testing & Deployment Guide

## Quick Start: Test → Commit → Push

### Phase 1: Local Testing (Without Docker)

#### 1.1 Set up environment variables
```bash
export NEO4J_URI=bolt://localhost:7687
export NEO4J_USER=neo4j
export NEO4J_PASSWORD=password
export WEAVIATE_URL=http://localhost:8080
export WEB_ORIGIN=http://localhost:3000
export LOG_LEVEL=INFO
```

#### 1.2 Install dependencies (if not already in venv)
```bash
# Activate virtual environment
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install requirements
pip install -r api/requirements.txt
```

#### 1.3 Run syntax check
```bash
python -m py_compile api/main.py api/rag.py api/models.py api/deps.py
echo "✓ All modules compile successfully"
```

---

### Phase 2: Docker Build & Local Integration Testing

#### 2.1 Build API image
```bash
docker build -f api/Dockerfile -t m10-api:latest .
# Expected: ~10-15 minutes (first build downloads 2GB+ of dependencies)
# Subsequent builds: ~1-2 minutes (layer caching)
```

#### 2.2 Verify image was created
```bash
docker images | grep m10-api
# Should show: m10-api    latest    <IMAGE_ID>    <SIZE>
```

#### 2.3 Start full stack (Neo4j + Weaviate + API)
```bash
# From repo root
docker compose up -d

# Wait for services to be healthy (check logs)
docker compose logs -f
# Press Ctrl+C when you see "lifespan_ready" in API logs
```

#### 2.4 Verify all services are running
```bash
docker compose ps
# All 3 services (api, neo4j, weaviate) should show "healthy" or "Up"

# Alternative: check health endpoints
curl http://localhost:8000/health
curl http://localhost:8000/readyz
```

---

### Phase 3: Test All Endpoints (In Order)

#### 3.1 Test `/health` endpoint (no dependencies)
```bash
curl -X GET http://localhost:8000/health \
  -H "Content-Type: application/json"

# Expected response:
# {"status":"ok"}
```

#### 3.2 Test `/healthz` endpoint (alias)
```bash
curl -X GET http://localhost:8000/healthz \
  -H "Content-Type: application/json"

# Expected response:
# {"status":"ok"}
```

#### 3.3 Test `/readyz` endpoint (checks dependencies)
```bash
curl -X GET http://localhost:8000/readyz \
  -H "Content-Type: application/json"

# Expected response (all healthy):
# {"neo4j":"ok","weaviate":"ok"}

# If not ready yet, wait and retry:
sleep 10 && curl http://localhost:8000/readyz
```

#### 3.4 Test `/extract` endpoint (NLP)
```bash
# Test 1: Valid input
curl -X POST http://localhost:8000/extract \
  -H "Content-Type: application/json" \
  -d '{"text": "Gordon Ramsay is a famous chef from the United Kingdom."}'

# Expected: 200 OK with entities extracted
# Example response:
# {
#   "entities": [
#     {"text": "Gordon Ramsay", "label": "PERSON", "start": 0, "end": 13},
#     {"text": "United Kingdom", "label": "GPE", "start": 56, "end": 70}
#   ]
# }

# Test 2: Invalid input (empty text) - should get 400
curl -X POST http://localhost:8000/extract \
  -H "Content-Type: application/json" \
  -d '{"text": ""}'

# Expected: 400 Bad Request
# Response: {"detail":"Text must not be empty."}
```

#### 3.5 Test `/kg/query` endpoint (Knowledge Graph)
```bash
# Test 1: Valid supported question
curl -X POST http://localhost:8000/kg/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What is pasta?"}'

# Expected: 200 OK with cypher query and results
# Example response:
# {
#   "cypher": "MATCH (n:Recipe {name: 'pasta'}) RETURN n",
#   "rows": [...],
#   "count": 3
# }

# Test 2: Unsupported question - should get 422
curl -X POST http://localhost:8000/kg/query \
  -H "Content-Type: application/json" \
  -d '{"question": "Tell me a joke"}'

# Expected: 422 Unprocessable Entity
# Response:
# {
#   "detail": {
#     "reason": "unsupported_question",
#     "supported_patterns": ["list", "of", "supported", "patterns"]
#   }
# }
```

#### 3.6 Test `/rag/answer` endpoint (Retrieval-Augmented Generation)
```bash
# Test 1: Valid question with default k=4
curl -X POST http://localhost:8000/rag/answer \
  -H "Content-Type: application/json" \
  -d '{"question": "How do you make risotto?"}'

# Expected: 200 OK with answer + citations
# Example response:
# {
#   "answer": "To make risotto, [1] gradually add warm broth while stirring. [2] Use high-quality ingredients.",
#   "citations": [
#     {"chunk_id": 42, "score": 0.95},
#     {"chunk_id": 57, "score": 0.89}
#   ],
#   "confidence": 0.92
# }

# Test 2: With custom k value
curl -X POST http://localhost:8000/rag/answer \
  -H "Content-Type: application/json" \
  -d '{"question": "Best Italian pasta?", "k": 6}'

# Expected: 200 OK (retrieves top 6 chunks instead of default 4)

# Test 3: Very short question (boundary)
curl -X POST http://localhost:8000/rag/answer \
  -H "Content-Type: application/json" \
  -d '{"question": "a"}'

# Expected: 200 OK (valid, min_length=1)
```

---

### Phase 4: Test Error Handling & Logging

#### 4.1 Check structured logs
```bash
# View API logs in real-time
docker compose logs -f api

# You should see JSON-formatted logs like:
# {"ts":"2026-06-25 18:30:45,123","level":"INFO","logger":"api","msg":"request_completed ..."}
```

#### 4.2 Test timeout behavior (optional, advanced)
```bash
# RAG generation timeout is set to 30 seconds by default
# To test with a shorter timeout, rebuild with env var:
docker compose down
export RAG_GENERATOR_TIMEOUT_SECONDS=2
docker compose up -d

# The next RAG request that takes >2s will return 503:
curl -X POST http://localhost:8000/rag/answer \
  -H "Content-Type: application/json" \
  -d '{"question": "Complex multi-step culinary technique?"}'

# May see: {"detail": {"reason": "generation_timeout", "detail": "..."}}
```

#### 4.3 Test with missing env vars (optional)
```bash
# Stop compose
docker compose down

# Rebuild API without WEAVIATE_URL
docker run -e NEO4J_URI=bolt://localhost:7687 m10-api:latest

# Should fail at startup with:
# RuntimeError: Missing required env vars: WEAVIATE_URL
```

---

### Phase 5: Performance & Integration Checks

#### 5.1 Test request concurrency
```bash
# Send 10 parallel requests (uses GNU parallel or xargs)
seq 1 10 | parallel -j 10 'curl -X POST http://localhost:8000/extract \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"Test request number {}\"}"'

# All should complete successfully; check logs for request_id tracking
docker compose logs api | grep "request_completed"
```

#### 5.2 Verify backward compatibility
```bash
# These requests should work identically to before:
curl -X POST http://localhost:8000/extract \
  -H "Content-Type: application/json" \
  -d '{"text": "Test"}'

# Check response format matches Pydantic schema
# Fields should be: text, label, start, end (NOT start_char, NOT chunkId, etc.)
```

#### 5.3 Check API contract (no breaking changes)
```bash
# Field names in /rag/answer response:
curl -X POST http://localhost:8000/rag/answer \
  -H "Content-Type: application/json" \
  -d '{"question": "test", "k": 4}' | python -m json.tool

# Should have fields: answer, citations (with chunk_id, score), confidence
# NOT: chunkId, chunkScore, etc.
```

---

### Phase 6: Prepare Commit

#### 6.1 Review changes
```bash
# See all modified files
git status

# Should show:
# modified: api/main.py
# modified: api/rag.py
# modified: api/Dockerfile
# new file: .dockerignore
# new file: BACKEND_IMPROVEMENTS_REPORT.md
```

#### 6.2 Check git diff (review code)
```bash
# Review API main changes
git diff api/main.py | head -100

# Review RAG pipeline changes
git diff api/rag.py | head -100

# Review Dockerfile
git diff api/Dockerfile

# Review dockerignore
git diff .dockerignore
```

#### 6.3 Run linter (optional but recommended)
```bash
# Install black (Python formatter)
pip install black

# Format API code
black api/main.py api/rag.py api/models.py api/deps.py

# Check for syntax errors
flake8 api/main.py api/rag.py --max-line-length=120
```

---

### Phase 7: Commit & Push

#### 7.1 Create feature branch (if not already on it)
```bash
# Make sure you're on the backend branch
git branch

# If not on backend/api-endpoints, create/switch to it:
git checkout -b backend/api-endpoints
# OR switch if it exists:
git checkout backend/api-endpoints

# Verify:
git branch
# Should show: * backend/api-endpoints
```

#### 7.2 Stage changes
```bash
# Stage all modified files
git add api/main.py api/rag.py api/Dockerfile .dockerignore BACKEND_IMPROVEMENTS_REPORT.md

# Verify staged changes
git status
# Should show all files in "Changes to be committed"
```

#### 7.3 Create descriptive commit
```bash
git commit -m "feat: backend API robustness improvements (Integration 10)

- Enhanced environment variable validation with sensible defaults
- Added structured JSON logging with request tracing (UUID request_id)
- Implemented comprehensive error handling in all endpoints
- Added /health endpoint alias for docker-compose compatibility
- Improved rag.py with detailed error handling and response validation
- Optimized Dockerfile layer caching (dependencies cached separately)
- Created .dockerignore to reduce build context size
- All changes maintain 100% backward compatibility with existing API contracts

Endpoints verified:
  ✓ /extract - Entity extraction with validation
  ✓ /kg/query - Knowledge graph with structured errors (422, 503)
  ✓ /rag/answer - RAG pipeline with timeout protection
  ✓ /healthz - Health check (no dependencies)
  ✓ /health - Alias for /healthz (docker-compose compatibility)
  ✓ /readyz - Readiness check (probes Neo4j + Weaviate)

Pydantic models: No breaking changes
Error responses: Consistent (422 for validation, 503 for dependency failures)
Logging: Structured JSON with request_id for distributed tracing"
```

#### 7.4 Verify commit
```bash
# See commit message
git log -1

# See what was committed
git show --stat
```

#### 7.5 Push to remote branch
```bash
# Push to your feature branch
git push origin backend/api-endpoints

# Verify push succeeded
git log --oneline -5 origin/backend/api-endpoints
```

---

### Phase 8: Create Pull Request (GitHub/GitLab)

#### 8.1 Visit GitHub repository
```bash
# Go to https://github.com/YOUR_ORG/m10-i10-team-5

# You should see a banner: "backend/api-endpoints had recent pushes"
# Click "Compare & pull request"
```

#### 8.2 Fill in PR details
```
Title: Backend API Robustness Improvements (Integration 10)

Description:
## Summary
Enhanced backend API with structured logging, comprehensive error handling, 
environment validation, and Docker optimization.

## Changes
- ✅ All 5 endpoints verified working
- ✅ Structured JSON logging with request tracing
- ✅ Comprehensive error handling (422, 503)
- ✅ Backward compatible (no breaking changes)
- ✅ Docker layer caching optimized

## Testing
- Local integration testing completed
- All endpoints tested (health, extract, kg/query, rag/answer)
- Error codes verified (400, 422, 503)
- Structured logging confirmed

## Files Changed
- api/main.py (11.5 KB)
- api/rag.py (6.2 KB)
- api/Dockerfile (1.7 KB)
- .dockerignore (new)
- BACKEND_IMPROVEMENTS_REPORT.md (documentation)

## Related
Closes: (if there's an issue number)

## Reviewers
@team-lead @infra-lead
```

#### 8.3 Request reviewers
```
Click "Reviewers" → Select team members
```

#### 8.4 Wait for CI/CD checks
```bash
# GitHub Actions will run (if configured):
# - Tests
# - Linting
# - Security scanning

# Once all checks pass (green ✓), you can merge
```

---

### Phase 9: Merge & Cleanup

#### 9.1 After PR approval, merge to main
```bash
# Option A: Merge via GitHub UI (recommended)
# Click "Merge pull request" button

# Option B: Merge locally
git checkout main
git pull origin main
git merge backend/api-endpoints
git push origin main
```

#### 9.2 Delete feature branch (optional)
```bash
# Delete local branch
git branch -d backend/api-endpoints

# Delete remote branch
git push origin --delete backend/api-endpoints
```

#### 9.3 Verify merge
```bash
# Check main branch has your changes
git log main --oneline | head -5

# Pull latest main
git pull origin main

# Verify files are there
ls api/main.py api/rag.py .dockerignore
```

---

### Phase 10: Deploy to Production (Optional)

#### 10.1 Rebuild image on production
```bash
# On production server
cd /path/to/repo
git pull origin main
docker build -f api/Dockerfile -t m10-api:latest .
```

#### 10.2 Restart services
```bash
docker compose down
docker compose up -d

# Verify services are healthy
docker compose ps
```

#### 10.3 Smoke test production
```bash
# Test health endpoints
curl https://api.yoursite.com/health
curl https://api.yoursite.com/readyz

# Test one endpoint
curl -X POST https://api.yoursite.com/extract \
  -H "Content-Type: application/json" \
  -d '{"text": "Production test"}'
```

---

## Troubleshooting

### API won't start
```bash
# Check logs
docker compose logs api

# Look for:
# - "Missing required env vars: ..."
# - "neo4j_driver_failed"
# - "weaviate_client_failed"

# Solution: Ensure docker-compose.yml has env vars set
# See docker-compose.yml for NEO4J_URI, WEAVIATE_URL
```

### Endpoints return 503
```bash
# /readyz shows services down
curl http://localhost:8000/readyz

# Wait for Neo4j + Weaviate to be healthy
docker compose logs neo4j | tail -20
docker compose logs weaviate | tail -20
```

### Request timeout on /rag/answer
```bash
# Set shorter timeout for testing
export RAG_GENERATOR_TIMEOUT_SECONDS=60
docker compose down
docker compose up -d

# Or check if generator is loaded
docker compose logs api | grep "generator_loaded"
```

### Port conflicts
```bash
# If port 8000/7687/8080 already in use
# Change ports in docker-compose.yml or kill processes

# Find what's using port 8000
lsof -i :8000
# Kill it:
kill -9 <PID>
```

---

## Summary Checklist

- [ ] Phase 1: Local testing with environment variables set
- [ ] Phase 2: Docker build successful (~10-15 min first time)
- [ ] Phase 3: All 6 endpoints respond correctly
- [ ] Phase 4: Logs are structured JSON with request_id
- [ ] Phase 5: Backward compatibility verified
- [ ] Phase 6: Code review (git diff) looks good
- [ ] Phase 7: Commit created on `backend/api-endpoints` branch
- [ ] Phase 8: PR created on GitHub with description
- [ ] Phase 9: PR approved and merged to main
- [ ] Phase 10: Production deployment verified (if applicable)

---

## Quick Command Reference

```bash
# Complete workflow in one go:

# 1. Test locally
export NEO4J_URI=bolt://localhost:7687
export WEAVIATE_URL=http://localhost:8080

# 2. Build & test in Docker
docker build -f api/Dockerfile -t m10-api:latest .
docker compose up -d
sleep 20  # Wait for services to be healthy

# 3. Run all endpoint tests
curl http://localhost:8000/health
curl http://localhost:8000/readyz
curl -X POST http://localhost:8000/extract -H "Content-Type: application/json" -d '{"text": "test"}'

# 4. Commit & push
git checkout backend/api-endpoints
git add api/main.py api/rag.py api/Dockerfile .dockerignore BACKEND_IMPROVEMENTS_REPORT.md
git commit -m "feat: backend API robustness improvements"
git push origin backend/api-endpoints

# 5. Create PR on GitHub (manual step, or use GitHub CLI)
gh pr create --base main --head backend/api-endpoints
```

Done! Your backend improvements are now ready for review and deployment.
