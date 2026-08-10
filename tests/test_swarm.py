"""
Tests for Swarm modules: agents, bus, worker.
"""

import asyncio
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from swarm.agents import AGENT_CONFIG, get_agent, list_agents
from swarm.bus import SwarmBus


# ── Agent Config ─────────────────────────────────────────

def test_config_complete():
    """All 5 agents must be defined."""
    expected = {"chief", "research", "programmer", "qa", "creator"}
    assert set(AGENT_CONFIG.keys()) == expected


def test_list_agents():
    """list_agents returns 5 agents with required fields."""
    agents = list_agents()
    assert len(agents) == 5
    for a in agents:
        assert "id" in a
        assert "name" in a
        assert "role" in a
        assert "status" in a
        assert "color" in a


def test_get_agent_valid():
    """get_agent returns config for known agent."""
    agent = get_agent("research")
    assert agent["name"] == "Research"
    assert agent["role"] == "Research & Learn"


def test_get_agent_invalid():
    """get_agent returns empty dict for unknown agent."""
    agent = get_agent("nonexistent")
    assert agent == {}


# ── SwarmBus ─────────────────────────────────────────────

@pytest.fixture
def bus_instance(tmp_path):
    """Create a temporary SwarmBus for testing."""
    db_path = str(tmp_path / "test_swarm.db")
    return SwarmBus(db_path=db_path)


@pytest.mark.asyncio
async def test_bus_init_db(bus_instance):
    """SwarmBus init_db creates tables."""
    await bus_instance.init_db()
    assert bus_instance._db is not None
    await bus_instance.close()


@pytest.mark.asyncio
async def test_bus_create_task(bus_instance):
    """create_task returns an 8-char task_id."""
    await bus_instance.init_db()
    task_id = await bus_instance.create_task(
        "research", {"instruction": "test instruction"}
    )
    assert len(task_id) == 8
    assert isinstance(task_id, str)
    await bus_instance.close()


@pytest.mark.asyncio
async def test_bus_update_task_status(bus_instance):
    """update_task_status changes task status."""
    await bus_instance.init_db()
    task_id = await bus_instance.create_task(
        "programmer", {"instruction": "write code"}
    )
    await bus_instance.update_task_status(task_id, "running")
    tasks = await bus_instance.get_tasks()
    assert any(t["task_id"] == task_id and t["status"] == "running" for t in tasks)
    await bus_instance.close()


@pytest.mark.asyncio
async def test_bus_log_event(bus_instance):
    """log_event writes to agent_logs table."""
    await bus_instance.init_db()
    task_id = await bus_instance.create_task("qa", {"instruction": "run tests"})
    await bus_instance.log_event(task_id, "qa", "INFO", "Test started")
    logs = await bus_instance.get_agent_logs()
    assert len(logs) >= 1
    assert logs[0]["agent_id"] == "qa"
    await bus_instance.close()


@pytest.mark.asyncio
async def test_bus_get_tasks_filter(bus_instance):
    """get_tasks with status filter works."""
    await bus_instance.init_db()
    tid1 = await bus_instance.create_task("research", {"instruction": "a"})
    tid2 = await bus_instance.create_task("qa", {"instruction": "b"})
    await bus_instance.update_task_status(tid1, "completed")
    pending = await bus_instance.get_tasks(status="pending")
    assert all(t["status"] == "pending" for t in pending)
    completed = await bus_instance.get_tasks(status="completed")
    assert any(t["task_id"] == tid1 for t in completed)
    await bus_instance.close()
