#!/usr/bin/env bash
# Seed the running Weaviate container with the chunked-docs fixture.
#
# Idempotent — the Python seeder skips chunk_ids already present.
#
# Run from the repo root (the directory containing docker-compose.yml)
# with the stack already up. Expected runtime ~10-45s depending on
# whether embeddings are pre-baked.

set -euo pipefail

docker compose exec -T api python seed_weaviate.py

echo "seed_weaviate.sh: vector index seeded into Weaviate."
