"""Tests for Phase 3 — Orchestration layer."""
import asyncio
import sys
import tempfile
from pathlib import Path

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))


def test_state_machine_valid_transitions():
    """Valid transitions are accepted."""
    from app.services.state_machine import TRANSITIONS, TaskStatus
    # queued → delegated is valid
    assert TaskStatus.DELEGATED in TRANSITIONS[TaskStatus.QUEUED]
    # done is terminal
    assert TRANSITIONS[TaskStatus.DONE] == []


def test_state_machine_invalid_transition():
    """Invalid transitions raise ValueError."""
    import asyncio
    from app.services.state_machine import transition_task, TaskStatus

    async def _check():
        import tempfile
        from app.db.database import init_db, get_db, close_db
        with tempfile.NamedTemporaryFile(suffix=".db") as f:
            await init_db(f"sqlite+aiosqlite:///{f.name}")
            db = await get_db()
            await db.execute("INSERT INTO tasks (id, title, status) VALUES ('t1', 'test', 'done')")
            await db.commit()
            try:
                await transition_task("t1", TaskStatus.RUNNING)  # done → running = invalid
                assert False, "Should have raised ValueError"
            except ValueError:
                pass  # expected
            await close_db()

    asyncio.run(_check())


def test_dispatcher_submit():
    """Dispatcher can submit tasks."""
    import asyncio
    from app.services.dispatcher import Dispatcher

    async def _check():
        import tempfile
        from app.db.database import init_db, close_db
        with tempfile.NamedTemporaryFile(suffix=".db") as f:
            await init_db(f"sqlite+aiosqlite:///{f.name}")
            d = Dispatcher()
            result = await d.submit("Test task", agent="mock")
            assert result["status"] == "queued"
            assert "task_id" in result
            queue = await d.get_queue()
            assert len(queue) == 1
            assert queue[0]["title"] == "Test task"
            await close_db()

    asyncio.run(_check())


def test_mock_adapter():
    """MockAdapter returns expected results."""
    import asyncio
    from app.services.agent_adapter import MockAdapter

    async def _check():
        a = MockAdapter()
        r = await a.send("t1", "do something", "mock")
        assert r["status"] == "sent"
        r = await a.poll_status("t1")
        assert r["status"] == "done"
        r = await a.collect_result("t1")
        assert r["status"] == "done"

    asyncio.run(_check())


def test_approval_gate():
    """Approval gate creates audit entries."""
    import asyncio
    from app.services.approval import request_approval, approve, reject

    async def _check():
        import tempfile
        from app.db.database import init_db, get_db, close_db
        with tempfile.NamedTemporaryFile(suffix=".db") as f:
            await init_db(f"sqlite+aiosqlite:///{f.name}")
            r = await request_approval("t1", "deploy", "Deploy to production")
            assert r["status"] == "awaiting_approval"
            r = await approve("t1", "admin")
            assert r["status"] == "approved"
            await close_db()

    asyncio.run(_check())


def test_cost_tracker():
    """Cost tracker records and summarizes."""
    import asyncio
    from app.services.cost_tracker import record_cost, get_cost_summary

    async def _check():
        import tempfile
        from app.db.database import init_db, close_db
        with tempfile.NamedTemporaryFile(suffix=".db") as f:
            await init_db(f"sqlite+aiosqlite:///{f.name}")
            await record_cost("hermes", "gpt-4", 1000, 500, 0.03, "t1")
            await record_cost("hermes", "gpt-4", 2000, 1000, 0.06, "t2")
            summary = await get_cost_summary("all")
            assert len(summary["breakdown"]) >= 1
            await close_db()

    asyncio.run(_check())
