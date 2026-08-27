"""Tests for hermes_status gateway detection (fast-path + parse fixes).

Avoids spawning the real heavy Hermes CLI by monkeypatching subprocess.
Cache is fully disabled per-test via monkeypatch on ``_cached`` so results
never leak from other test modules (e.g. test_server.py).
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import modules.hermes_status as hs


@pytest.fixture(autouse=True)
def no_cache(monkeypatch):
    """Disable module cache entirely — force recompute every call."""
    monkeypatch.setattr(hs, "_cached", lambda key: None)
    yield


class TestGatewayFastPath:
    def test_pgrep_finds_pid(self, monkeypatch):
        """When pgrep returns a PID, gateway is online without CLI call."""
        calls = []

        def fake_run(args, *a, **k):
            calls.append(list(args))
            return type("R", (), {"returncode": 0, "stdout": "573\n"})()

        monkeypatch.setattr(hs.subprocess, "run", fake_run)
        pid = hs._gateway_pid_pgrep()
        assert pid == 573
        # pgrep path must not invoke the heavy hermes CLI binary
        hermes_cli_calls = [
            c for c in calls
            if c and str(c[0]).endswith("hermes") and "gateway" in str(c)
        ]
        assert hermes_cli_calls == []

    def test_gateway_online_via_pgrep(self, monkeypatch):
        monkeypatch.setattr(hs, "_gateway_pid_pgrep", lambda: 573)
        data = hs.gateway_status()
        assert data["online"] is True
        assert data["pid"] == 573
        assert data["simulated"] is False

    def test_gateway_offline_no_pid_no_cli(self, monkeypatch):
        monkeypatch.setattr(hs, "_gateway_pid_pgrep", lambda: None)
        monkeypatch.setattr(
            hs, "_run",
            lambda cmd, timeout=10: {"rc": 0, "out": "gateway not running", "err": ""},
        )
        data = hs.gateway_status()
        assert data["online"] is False
        assert data["pid"] is None

    def test_gateway_parse_real_cli_output(self, monkeypatch):
        """Real CLI output uses 'supervised by launchd (PID 573)' — must parse."""
        monkeypatch.setattr(hs, "_gateway_pid_pgrep", lambda: None)
        real_out = "✓ Gateway is supervised by launchd (PID 573)\n  Auto-start at login available.\n"
        monkeypatch.setattr(
            hs, "_run",
            lambda cmd, timeout=10: {"rc": 0, "out": real_out, "err": ""},
        )
        data = hs.gateway_status()
        assert data["online"] is True
        assert data["pid"] == 573


class TestCronTimeout:
    def test_cron_uses_longer_timeout(self, monkeypatch):
        captured = {}

        def fake_run(args, timeout=10):
            captured["timeout"] = timeout
            return {"rc": 0, "out": "", "err": ""}

        monkeypatch.setattr(hs, "_run", fake_run)
        monkeypatch.setattr(hs, "_is_cli_available", lambda: True)
        monkeypatch.setattr(hs, "_gateway_pid_pgrep", lambda: 573)
        hs.cron_jobs()
        assert captured.get("timeout", 10) >= 20
