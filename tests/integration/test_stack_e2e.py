"""End-to-end smoke harness — Infra-Integration lead authors.

Brings the four-service stack up via `docker compose up -d --wait` and
verifies the demo `/rag/answer` curl returns 200 with citations against
the seeded fixture. Skipped in the autograder (which exercises compose
topology structurally, not at runtime); used locally during demo-prep
and by the TA during walkthrough.
"""
import json
import os
import subprocess
import time

import pytest
import requests

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
API_URL = os.environ.get("API_URL", "http://localhost:8000")
SEEDED_QUESTION = "How do I prep ginger for stir-fry?"
HEALTHY_TIMEOUT_S = 600
POLL_INTERVAL_S = 5


def _run(cmd, **kwargs):
    return subprocess.run(cmd, cwd=REPO_ROOT, check=True, **kwargs)


def _all_services_healthy() -> bool:
    out = subprocess.run(
        ["docker", "compose", "ps", "--format", "json"],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    services = {}
    for line in out.splitlines():
        line = line.strip()
        if not line:
            continue
        obj = json.loads(line)
        for o in obj if isinstance(obj, list) else [obj]:
            services[o.get("Service")] = o.get("Health", "")
    required = {"neo4j", "weaviate", "api", "web"}
    return required.issubset(services) and all(services[s] == "healthy" for s in required)


@pytest.mark.skipif(
    os.environ.get("RUN_STACK_E2E") != "1",
    reason="set RUN_STACK_E2E=1 to bring up the real Docker Compose stack",
)
def test_stack_e2e_seeded_rag_query():
    _run(["docker", "compose", "up", "-d", "--build"])

    deadline = time.time() + HEALTHY_TIMEOUT_S
    while time.time() < deadline:
        if _all_services_healthy():
            break
        time.sleep(POLL_INTERVAL_S)
    else:
        pytest.fail(f"stack did not report healthy within {HEALTHY_TIMEOUT_S}s")

    _run(["bash", "scripts/seed_neo4j.sh"])
    _run(["bash", "scripts/seed_weaviate.sh"])

    resp = requests.post(
        f"{API_URL}/rag/answer",
        json={"question": SEEDED_QUESTION},
        timeout=30,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["citations"]) > 0
    assert body["confidence"] > 0
    assert body["answer"]
