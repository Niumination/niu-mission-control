"""Agent adapter interface — protocol for communicating with AI agents."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class AgentAdapter(ABC):
    """Protocol: all agent adapters must implement this interface."""

    @abstractmethod
    async def send(self, task_id: str, instruction: str, agent: str) -> dict:
        """Send a task to the agent for execution."""
        ...

    @abstractmethod
    async def poll_status(self, task_id: str) -> dict:
        """Poll the agent for task status."""
        ...

    @abstractmethod
    async def collect_result(self, task_id: str) -> dict:
        """Collect the result of a completed task."""
        ...


class HermesAdapter(AgentAdapter):
    """Adapter for Hermes Agent (CLI bridge)."""

    def __init__(self, hermes_home: str = "/Volumes/HermesAgent/HermesAgentUSB/data"):
        self.hermes_home = hermes_home

    async def send(self, task_id: str, instruction: str, agent: str) -> dict:
        # TODO: Bridge to Hermes CLI (hermes send / hermes dispatch)
        return {"status": "sent", "task_id": task_id, "agent": agent}

    async def poll_status(self, task_id: str) -> dict:
        # TODO: Check dispatch status from Hermes
        return {"status": "running", "task_id": task_id}

    async def collect_result(self, task_id: str) -> dict:
        # TODO: Collect result from Hermes
        return {"status": "done", "task_id": task_id, "result": ""}


class MockAdapter(AgentAdapter):
    """Mock adapter for testing and development."""

    async def send(self, task_id: str, instruction: str, agent: str) -> dict:
        return {"status": "sent", "task_id": task_id, "agent": agent}

    async def poll_status(self, task_id: str) -> dict:
        return {"status": "done", "task_id": task_id}

    async def collect_result(self, task_id: str) -> dict:
        return {"status": "done", "task_id": task_id, "result": "Mock result"}


# ── Registry ───────────────────────────────────────────────
ADAPTERS: dict[str, AgentAdapter] = {
    "hermes": HermesAdapter(),
    "mock": MockAdapter(),
}


def get_adapter(name: str = "hermes") -> AgentAdapter:
    return ADAPTERS.get(name, MockAdapter())
