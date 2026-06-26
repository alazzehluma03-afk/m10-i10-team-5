# Integration 10 — Dockerize the Four-Service Stack

Compose the Lab's FastAPI backend and Next.js frontend with
**containerized Neo4j and Weaviate** into a one-command Dockerized
stack delivered as a 3-Team-Member team.

> Read the full Integration guide on the cohort site:
> <https://LevelUp-Applied-AI.github.io/aispire-14005-pages/modules/module-10/a0cae6a2>
>
> Team-facing spec:
> <https://LevelUp-Applied-AI.github.io/aispire-14005-pages/modules/module-10/4ba363ed>

## Team Roles

See [TEAM.md](TEAM.md) for role assignments and the per-role file
checklist. See [CONTRIBUTING.md](CONTRIBUTING.md) for the internal-PR
review convention and the contract-change protocol.

## Starter Layout

```
api/                      Pre-implemented FastAPI backend (do not modify
                          unless extending; the Backend lead extends here)
web/                      Pre-implemented Next.js frontend
docker-compose.yml        Skeleton — Infra-Integration lead authors
scripts/
  seed_neo4j.sh           Stub — Infra-Integration lead authors
  seed_weaviate.sh        Stub — Infra-Integration lead authors
  healthcheck_stack.sh    Stub — Infra-Integration lead authors
.env.example              Placeholder credentials
TEAM.md                   Team roster — team fills in
CONTRIBUTING.md           Branch convention + internal-PR protocol
```

## Bring up the stack (runbook)

Run every command below from the repo root (the directory containing
`docker-compose.yml`) — `docker compose exec` and the scripts resolve
service names against the Compose project in the current working
directory.

1. Clone the repo and `cd` into it.

   ```bash
   git clone https://github.com/<team-fork-owner>/m10-i10-team-N.git
   cd m10-i10-team-N
   ```

2. Create your local env file and fill in `NEO4J_PASSWORD` (and
   `NEO4J_AUTH`, which must match it: `neo4j/<same password>`). The
   real `.env` is `.gitignore`'d and must never be committed.

   ```bash
   cp .env.example .env
   ```

3. Build and start all four services in the background.

   ```bash
   docker compose up -d --build
   ```

4. Wait for all four services to report healthy. The data tier
   (Neo4j + Weaviate) should reach healthy within ~2 minutes; `api`
   within ~5 minutes on a cold HuggingFace cache (it downloads spaCy
   and `flan-t5-base` on first boot); `web` within ~2 minutes.

   ```bash
   bash scripts/healthcheck_stack.sh
   docker compose ps
   ```

5. Seed the recipe graph into Neo4j.

   ```bash
   bash scripts/seed_neo4j.sh
   ```

6. Seed the vector index into Weaviate.

   ```bash
   bash scripts/seed_weaviate.sh
   ```

7. Open <http://localhost:3000/rag> in a browser.

8. Submit the seeded question "Find Sichuan recipes that use ginger"
   (or "How do I prep ginger for stir-fry?") and observe a grounded,
   cited answer.

   Equivalent demo curl against the API directly:

   ```bash
   curl -s -X POST http://localhost:8000/rag/answer \
     -H 'Content-Type: application/json' \
     -d '{"question": "How do I prep ginger for stir-fry?"}' | jq .
   ```

9. Tear down (drops named volumes — re-running step 3 starts from an
   empty stack and steps 5–6 repopulate it without error).

   ```bash
   docker compose down -v
   ```

## Submission

Team submission (one per team): the team submitter pastes the team
fork's main-branch URL into TalentLMS → Module 10 → Integration Task.

Per-Team-Member participation confirmation (one per Team Member): each
Team Member separately submits a TalentLMS checkbox confirming
participation, naming their assigned role, and naming the files they
authored.

---

## License

This repository is provided for educational use only. See
[LICENSE](LICENSE) for terms. You may clone and modify this repository
for personal learning and practice, and reference code you wrote here
in your professional portfolio. Redistribution outside this course is
not permitted.
