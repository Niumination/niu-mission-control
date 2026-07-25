import pytest
from server import app
from fastapi.testclient import TestClient

client = TestClient(app)

def test_health():
    r = client.get("/api/mc/system")
    assert r.status_code == 200
    assert "health_score" in r.json()
