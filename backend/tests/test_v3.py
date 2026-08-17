"""Tests for the new v3.0.0 backend (Phase 2)."""
import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))


def test_config_loads():
    """Settings loads from defaults."""
    from app.core.config import Settings
    s = Settings()
    assert s.rate_limit_rpm == 60
    assert s.debug is False


def test_middleware_public_paths():
    """Public paths are correctly identified."""
    from app.core.middleware import _is_public
    assert _is_public("/") is True
    assert _is_public("/health") is True
    assert _is_public("/static/app.js") is True
    assert _is_public("/docs") is True
    assert _is_public("/api/mc/system") is False
    assert _is_public("/api/mc/tasks") is False
    assert _is_public("/api/mc/hermes") is False


def test_rate_limit():
    """Rate limiter works."""
    from app.core.middleware import _check_rate_limit, _rate_store
    ip = "test_ratelimit_123"
    _rate_store[ip] = []  # reset
    assert _check_rate_limit(ip, max_rpm=3) is True
    assert _check_rate_limit(ip, max_rpm=3) is True
    assert _check_rate_limit(ip, max_rpm=3) is True
    assert _check_rate_limit(ip, max_rpm=3) is False  # exceeded
    _rate_store.pop(ip, None)  # cleanup


def test_app_factory():
    """create_app returns a FastAPI instance."""
    from app.main import create_app
    app = create_app()
    assert app.title == "Niu-MissionControl"
    assert app.version == "3.0.0"


def test_db_schema():
    """Database tables are created correctly."""
    import asyncio
    import tempfile
    from app.db.database import init_db, get_db, close_db

    with tempfile.NamedTemporaryFile(suffix=".db") as f:
        db_url = f"sqlite+aiosqlite:///{f.name}"

        async def _check():
            await init_db(db_url)
            db = await get_db()
            # Check tables exist
            cursor = await db.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [row[0] for row in await cursor.fetchall()]
            assert "tasks" in tables
            assert "events" in tables
            assert "dispatches" in tables
            assert "audit" in tables
            assert "cost" in tables
            await close_db()

        asyncio.run(_check())
