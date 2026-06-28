# Team Roster — Module 10 Integration

---

## Team Identity

- **Team name:** `team-5`
- **Team Slack channel:** `#m10-team-5`
- **Team-formation date:** `2026-06-25`
- **Designated team submitter:** `Infra-Integration lead`

---

## Team Roster

| Role | Team Member identifier | Assigned by | Branch | Internal-PR reviewer | Primary files owned |
|---|---|---|---|---|---|
| Backend lead | `LA` | Instructional team | `backend/api-endpoints` | Frontend lead | `api/main.py`, `api/models.py`, `api/rag.py`, `api/deps.py`, `api/Dockerfile` |
| Frontend lead | `HR` | Instructional team | `frontend/nextjs-pages` | Backend lead | `web/pages/{extract,kg,rag}.tsx`, `web/lib/types.ts`, `web/Dockerfile`, `tests/frontend/playwright/*` |
| Infra-Integration lead | `HB` | Instructional team | `infra/docker-compose` | Backend lead | `docker-compose.yml`, `seed_neo4j.sh`, `seed_weaviate.sh`, `.env.example`, `README.md`, `tests/integration/*` |

---

## Per-Role File Checklist

### Backend lead

- [x] `api/main.py` — path operations, `lifespan`, CORS middleware
- [x] `api/models.py` — Pydantic shapes
- [x] `api/rag.py` — RAG composer with grounding contract
- [x] `api/deps.py` — `Depends()` functions
- [x] `api/Dockerfile` — single-stage Python

### Frontend lead

- [x] `web/pages/extract.tsx`
- [x] `web/pages/kg.tsx`
- [x] `web/pages/rag.tsx`
- [x] `web/lib/types.ts`
- [x] `web/Dockerfile`
- [x] `tests/frontend/playwright/*.spec.ts`

### Infra-Integration lead

- [x] `docker-compose.yml`
- [x] `seed_neo4j.sh`
- [x] `seed_weaviate.sh`
- [x] `.env.example`
- [x] `README.md`
- [x] `tests/integration/test_stack_e2e.py`

---

# Contribution Summary

### Backend lead (LA)

Implemented the FastAPI backend API endpoints, request/response models, dependency injection, Docker image, and the RAG pipeline. Responsible for the backend application lifecycle, retrieval pipeline, and API contract consumed by the frontend.

### Frontend lead (HR)

Implemented the complete Next.js frontend, including the Extract, Knowledge Graph, and RAG pages, TypeScript interfaces, Playwright end-to-end tests, UI integration with the backend APIs, and final frontend integration work before merging into the team `main` branch.

### Infra-Integration lead (HB)

Implemented the Docker Compose stack, service orchestration, health checks, startup ordering, environment configuration, Neo4j and Weaviate seed scripts, project runbook, and end-to-end integration tests to ensure the complete four-service stack runs successfully.

---

## Submission

When all role branches were merged into the team fork `main`, the project was verified locally using Docker Compose and submitted according to the Module 10 Integration requirements.