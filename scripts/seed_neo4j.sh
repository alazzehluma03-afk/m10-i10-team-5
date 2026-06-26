#!/usr/bin/env bash
# Seed the running Neo4j container with the recipe fixture.
#
# Idempotent — `MERGE` and `CREATE CONSTRAINT IF NOT EXISTS` in seed.cypher
# mean repeat runs do not duplicate nodes.
#
# Run from the repo root (the directory containing docker-compose.yml)
# with the stack already up.

set -euo pipefail

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

: "${NEO4J_USER:?NEO4J_USER must be set (cp .env.example .env and fill it in)}"
: "${NEO4J_PASSWORD:?NEO4J_PASSWORD must be set (cp .env.example .env and fill it in)}"

SEED_FILE="api/seed.cypher"
if [ ! -f "$SEED_FILE" ]; then
  echo "error: $SEED_FILE not found in $(pwd) — run this script from the repo root" >&2
  exit 1
fi

docker compose exec -T neo4j cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" < "$SEED_FILE"

echo "seed_neo4j.sh: recipe graph seeded into Neo4j."
