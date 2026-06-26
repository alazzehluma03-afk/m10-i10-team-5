#!/usr/bin/env bash
# Poll `docker compose ps` until all four services report healthy or
# until the 90s budget expires.
#
# Run from the repo root with the stack already up (docker compose up -d).

set -euo pipefail

SERVICES=(neo4j weaviate api web)
MAX_ITER=45
SLEEP_SECS=2

all_healthy() {
  local status
  status="$(docker compose ps --format json)"
  for svc in "${SERVICES[@]}"; do
    python3 - "$svc" <<'PYEOF' <<<"$status" || return 1
import json, sys
svc = sys.argv[1]
found = False
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    obj = json.loads(line)
    objs = obj if isinstance(obj, list) else [obj]
    for o in objs:
        if o.get("Service") == svc:
            found = True
            if o.get("Health", "") != "healthy":
                sys.exit(1)
if not found:
    sys.exit(1)
PYEOF
  done
}

for ((i = 0; i < MAX_ITER; i++)); do
  if all_healthy; then
    echo "healthcheck_stack.sh: all services (${SERVICES[*]}) are healthy."
    exit 0
  fi
  sleep "$SLEEP_SECS"
done

echo "healthcheck_stack.sh: timed out after $((MAX_ITER * SLEEP_SECS))s waiting for healthy services." >&2
docker compose ps >&2
exit 1
