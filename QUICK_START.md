# QUICK START: 10-Minute Testing & Deploy

**TL;DR:** Copy-paste these commands in order. ~10 minutes total.

## Step 1: Set Environment (1 min)
```bash
export NEO4J_URI=bolt://localhost:7687
export NEO4J_USER=neo4j
export NEO4J_PASSWORD=password
export WEAVIATE_URL=http://localhost:8080
export WEB_ORIGIN=http://localhost:3000
export LOG_LEVEL=INFO
```

## Step 2: Build Docker Image (5-10 min, mostly waiting)
```bash
docker build -f api/Dockerfile -t m10-api:latest .
# First build: ~5-10 min (downloads dependencies)
# Subsequent: ~1 min (cached layers)
```

## Step 3: Start Services (1 min)
```bash
docker compose up -d
sleep 15  # Wait for startup
docker compose ps  # Verify all "healthy"
```

## Step 4: Quick Endpoint Tests (2 min)
```bash
# Test 1: Health
curl http://localhost:8000/health

# Test 2: Ready
curl http://localhost:8000/readyz

# Test 3: Extract
curl -X POST http://localhost:8000/extract \
  -H "Content-Type: application/json" \
  -d '{"text": "Gordon Ramsay is a chef from the UK"}'

# Test 4: KG Query (should work or return 422)
curl -X POST http://localhost:8000/kg/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What is pasta?"}'

# Test 5: RAG Answer
curl -X POST http://localhost:8000/rag/answer \
  -H "Content-Type: application/json" \
  -d '{"question": "How to make risotto?", "k": 4}'

# All should return 200 or expected error (422, 503)
```

## Step 5: Review Changes
```bash
git status
# Should show modified files and new files
```

## Step 6: Commit
```bash
git checkout -b backend/api-endpoints
git add api/main.py api/rag.py api/Dockerfile .dockerignore BACKEND_IMPROVEMENTS_REPORT.md TESTING_AND_DEPLOYMENT_GUIDE.md
git commit -m "feat: backend API robustness improvements"
```

## Step 7: Push
```bash
git push origin backend/api-endpoints
```

## Step 8: Create PR on GitHub
```bash
# Go to https://github.com/YOUR_ORG/m10-i10-team-5
# Click "Compare & pull request" 
# Fill in title and description
# Request reviewers
# Click "Create pull request"
```

## Step 9: Wait for Approval & Merge
```bash
# Reviewer approves PR
# Click "Merge pull request" on GitHub
```

## Done!
Your code is now on `main` branch. In production, redeploy:
```bash
docker compose pull
docker compose up -d
```

---

## If Something Fails

**API won't start:**
```bash
docker compose logs api | tail -30
# Check for "env_validation_failed" or "neo4j_driver_failed"
```

**Endpoints return 503:**
```bash
curl http://localhost:8000/readyz
# Wait longer for Neo4j/Weaviate to boot
sleep 30 && curl http://localhost:8000/readyz
```

**Port 8000 already in use:**
```bash
lsof -i :8000
kill -9 <PID>
docker compose down && docker compose up -d
```

**Docker build stuck:**
```bash
# Ctrl+C, then:
docker builder prune -a
docker build -f api/Dockerfile -t m10-api:latest .
```

---

## All Files Changed

✓ `api/main.py` — Rewritten (structured logging, error handling)  
✓ `api/rag.py` — Enhanced (validation, error messages)  
✓ `api/Dockerfile` — Optimized (caching layers)  
✓ `.dockerignore` — Created (reduce build context)  
✓ `BACKEND_IMPROVEMENTS_REPORT.md` — Created (documentation)  
✓ `TESTING_AND_DEPLOYMENT_GUIDE.md` — Created (this detailed guide)  

## Verify Nothing Broke

```bash
# All field names unchanged (no breaking changes)
curl -X POST http://localhost:8000/rag/answer \
  -H "Content-Type: application/json" \
  -d '{"question": "test", "k": 4}' | python -m json.tool
# Should have: answer, citations (with chunk_id, score), confidence
```

**Ready to ship!** 🚀
