"""Tests for hermes_status gateway detection (fast-path + parse fixes).

Avoids spawning the real heavy Hermes CLI by monkeypatching subprocess.
Cache is fully disabled per-test via monkeypatch on ``_cached`` so results
never leak from other test modules (e.g. test_server.py).

NOTE: force _is_cli_available()=True so we always exercise the REAL branch
(pgrep / CLI parse), not the SIMULATED mock fallback (which returns pid 41203
and would make assertions flaky between local and CI runners).
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import modules.hermes_status as hs


@pytest.fixture(autouse=True)
def real_branch(monkeypatch):
    """Disable cache + force CLI-available so we test the real code path."""
    monkeypatch.setattr(hs, "_cached", lambda key: None)
    monkeypatch.setattr(hs, "_is_cli_available", lambda: True)
    yield


class TestGatewayFastPath:
    def test_pgrep_finds_pid(self, monkeypatch):
        """When psutil finds the gateway process, gateway is online without CLI call."""
        calls = []

        class FakeProc:
            def __init__(self, pid, cmdline):
                self.info = {"pid": pid, "cmdline": cmdline}

        # psutil.process_iter yields a process whose cmdline contains hermes_cli.main gateway
        procs = [FakeProc(573, ["python", "-m", "hermes_cli.main", "gateway", "run", "--replace"])]
        monkeypatch.setattr(
            hs.psutil, "process_iter",
            lambda *a, **k: iter(procs),
        )
        pid = hs._gateway_pid_pgrep()
        assert pid == 573

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
        monkeypatch.setattr(hs, "_gateway_pid_pgrep", lambda: 573)
        hs.cron_jobs()
        assert captured.get("timeout", 10) >= 20
