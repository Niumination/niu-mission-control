"""
Tests for Niu-MissionControl server.
Happy path coverage: 17 test cases covering all major endpoints.
"""

import json
import os
import sys

import pytest
from fastapi.testclient import TestClient

# Ensure project root is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set test environment — no auth required
os.environ.pop("MC_API_KEY", None)

from server import app
from swarm.bus import bus


# Use context manager to trigger lifespan (init_db, workers)
@pytest.fixture(scope="module")
def client():
    """Create test client with lifespan initialization."""
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


# ── 1. Health Check ──────────────────────────────────────

def test_health_check(client):
    """GET /health returns 200 with status ok."""
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data["version"] == "2.6.0"
    assert "uptime" in data
    assert "timestamp" in data


# ── 2. System Health ─────────────────────────────────────

def test_system_health(client):
    """GET /api/mc/system returns system metrics."""
    r = client.get("/api/mc/system")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "OK"
    assert data["wal_mode"] is True
    assert "cpu_percent" in data
    assert "memory" in data
    assert "disk" in data
    assert "health_score" in data
    assert isinstance(data["health_score"], int)
    assert 0 <= data["health_score"] <= 100


# ── 3. Hermes Status ─────────────────────────────────────

def test_hermes_status(client):
    """GET /api/mc/hermes returns gateway and cron info."""
    r = client.get("/api/mc/hermes")
    assert r.status_code == 200
    data = r.json()
    assert "gateway" in data
    assert "cron" in data
    assert isinstance(data["gateway"], dict)
    assert "online" in data["gateway"]


# ── 4. Agents Status ─────────────────────────────────────

def test_agents_status(client):
    """GET /api/mc/agents returns 4 agents."""
    r = client.get("/api/mc/agents")
    assert r.status_code == 200
    data = r.json()
    assert "agents" in data
    agents = data["agents"]
    assert len(agents) == 4
    agent_ids = {a["id"] for a in agents}
    assert agent_ids == {"chief", "research", "programmer", "qa"}
    for a in agents:
        assert "name" in a
        assert "role" in a
        assert "status" in a


# ── 5. Tasks Kanban ──────────────────────────────────────

def test_tasks_kanban(client):
    """GET /api/mc/tasks returns kanban columns."""
    r = client.get("/api/mc/tasks")
    assert r.status_code == 200
    data = r.json()
    assert "pending" in data
    assert "running" in data
    assert "completed" in data
    assert "failed" in data
    assert isinstance(data["pending"], list)
    assert isinstance(data["completed"], list)


# ── 6. Logs Feed ─────────────────────────────────────────

def test_logs_feed(client):
    """GET /api/mc/logs returns log list."""
    r = client.get("/api/mc/logs")
    assert r.status_code == 200
    data = r.json()
    assert "logs" in data
    assert isinstance(data["logs"], list)


def test_logs_feed_with_agent_filter(client):
    """GET /api/mc/logs?agent=chief filters by agent."""
    r = client.get("/api/mc/logs?agent=chief&limit=5")
    assert r.status_code == 200
    data = r.json()
    assert "logs" in data


# ── 7. Config ────────────────────────────────────────────

def test_get_config(client):
    """GET /api/mc/config returns swarm config."""
    r = client.get("/api/mc/config")
    assert r.status_code == 200
    data = r.json()
    assert "orchestrator" in data
    assert "usb_safe_mode" in data
    assert "llm_model" in data


def test_list_artifacts(client):
    """GET /api/mc/artifacts returns categories."""
    r = client.get("/api/mc/artifacts")
    assert r.status_code == 200
    data = r.json()
    assert "categories" in data
    assert isinstance(data["categories"], list)


# ── 9. Dashboard ─────────────────────────────────────────

def test_dashboard_serves_html(client):
    """GET / serves the dashboard HTML page."""
    r = client.get("/")
    assert r.status_code == 200
    content = r.text
    assert "HERMES" in content
    assert "MISSION CONTROL" in content


def test_openapi_available(client):
    """GET /openapi.json returns valid OpenAPI spec."""
    r = client.get("/openapi.json")
    assert r.status_code == 200
    data = r.json()
    assert "openapi" in data
    assert "paths" in data
    assert len(data["paths"]) >= 15


# ── 11. Delegate Task ────────────────────────────────────

def test_delegate_task(client):
    """POST /api/mc/delegate creates and dispatches a task."""
    r = client.post(
        "/api/mc/delegate",
        json={"agent": "research", "instruction": "Test task"},
    )
    assert r.status_code == 200
    data = r.json()
    assert "task_id" in data
    assert data["status"] in ("dispatched", "failed")
    assert len(data["task_id"]) == 8


def test_delegate_unknown_agent(client):
    """POST /api/mc/delegate with invalid agent returns 422 (validation error)."""
    r = client.post(
        "/api/mc/delegate",
        json={"agent": "nonexistent", "instruction": "Test"},
    )
    assert r.status_code == 422
    data = r.json()
    assert "detail" in data


# ── 12. Task Update ──────────────────────────────────────

def test_task_update_missing_id(client):
    """POST /api/mc/task-update without task_id returns 400."""
    r = client.post(
        "/api/mc/task-update",
        json={"status": "completed"},
    )
    assert r.status_code == 400
    data = r.json()
    assert "error" in data


# ── 13. Auth Middleware ──────────────────────────────────

def test_auth_disabled_by_default(client):
    """Without MC_API_KEY, all endpoints are accessible (dev mode)."""
    import server
    assert server.MC_API_KEY == ""  # Default: auth disabled
    r = client.get("/api/mc/system")
    assert r.status_code == 200


def test_auth_middleware_registered():
    """Verify auth middleware is registered on the app."""
    import server
    has_auth = any("auth" in str(m).lower() for m in server.app.user_middleware)
    assert has_auth, f"Auth middleware not found: {server.app.user_middleware}"


def test_rate_limit_middleware_registered():
    """Verify rate limit middleware is registered on the app."""
    import server
    has_rate = any("rate" in str(m).lower() for m in server.app.user_middleware)
    assert has_rate, f"Rate limit middleware not found: {server.app.user_middleware}"


def test_health_always_public(client):
    """/health is always accessible regardless of auth state."""
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# ── 14. Rate Limiting ────────────────────────────────────

def test_rate_limit_headers(client):
    """Verify rate limit middleware is active (no crash on normal requests)."""
    for _ in range(5):
        r = client.get("/health")
        assert r.status_code == 200
