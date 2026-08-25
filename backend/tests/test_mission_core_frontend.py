"""Static contract tests for the APEX-inspired Mission Core frontend."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DASHBOARD = ROOT / "dashboard"


def test_mission_core_assets_are_wired():
    """The ORB shell must load every layer required by the Mission Core."""
    html = (DASHBOARD / "orb.html").read_text(encoding="utf-8")

    assert 'id="mission-core-world"' in html
    assert 'id="reasoning-web"' in html
    assert 'id="core-activation"' in html
    assert 'id="core-agent-dialog"' in html
    assert '/static/apex-adaptation.css' in html
    assert '/static/reasoning-web.js' in html
    assert '/static/orb.js' in html

    for name in ("apex-adaptation.css", "reasoning-web.js", "orb.js"):
        assert (DASHBOARD / name).is_file(), f"missing dashboard/{name}"


def test_mission_core_uses_real_niu_telemetry_contracts():
    """The adaptation must use Niumination's fleet, not APEX's demo roster."""
    orb_js = (DASHBOARD / "orb.js").read_text(encoding="utf-8")
    graph_js = (DASHBOARD / "reasoning-web.js").read_text(encoding="utf-8")

    assert "'/api/mc/agents'" in orb_js
    assert "/ws/swarm" in orb_js
    for agent_id in ("chief", "research", "programmer", "qa", "creator"):
        assert f"id: '{agent_id}'" in graph_js

    assert "chief_of_staff" not in graph_js
    assert "social_media" not in graph_js


def test_reduced_motion_and_accessible_agent_controls_are_present():
    css = (DASHBOARD / "apex-adaptation.css").read_text(encoding="utf-8")
    html = (DASHBOARD / "orb.html").read_text(encoding="utf-8")
    graph_js = (DASHBOARD / "reasoning-web.js").read_text(encoding="utf-8")

    assert "prefers-reduced-motion: reduce" in css
    assert 'aria-live="polite"' in html
    assert 'aria-modal="true"' in html
    assert 'aria-label="Agent Niumination"' in html
    assert "refreshHiddenList" in graph_js
    assert "event.key === 'Escape'" in graph_js


def test_agent_state_module_recognises_production_statuses():
    """Real logic test: status mapping must flag thinking/executing as busy.

    Shells out to `node` and loads the shared dashboard/agent-state.js module
    (the single source of truth used by both orb.js and reasoning-web.js), then
    injects production-style fixtures ({status:'executing'}, {status:'thinking'})
    and asserts the mapping reports them busy — no string-presence assertion.
    """
    AGENT_STATE = DASHBOARD / "agent-state.js"
    assert AGENT_STATE.is_file(), "dashboard/agent-state.js must exist"

    node_script = """
        const fs = require('fs');
        const path = require('path');
        const m = require(%r);
        const cases = [
            {status: 'executing'}, {status: 'thinking'},
            {status: 'running'}, {status: 'processing'}, {status: 'working'},
            {status: 'idle'}, {status: 'offline'}, {status: 'online'},
            {running: 1}, {running: 0},
        ];
        const out = cases.map((a) => ({
            in: a,
            busy: m.isAgentBusy(a),
            kind: m.statusKind(a),
        }));
        process.stdout.write(JSON.stringify(out));
    """ % str(AGENT_STATE)

    import json
    import shutil
    import subprocess

    node = shutil.which("node")
    assert node, "node executable required for integration test"
    result = subprocess.run(
        [node, "-e", node_script],
        capture_output=True, text=True, timeout=60,
    )
    assert result.returncode == 0, f"node failed: {result.stderr}"
    results = {json.dumps(c["in"], sort_keys=True): c for c in json.loads(result.stdout)}

    # Production statuses must be busy.
    assert results[json.dumps({"status": "executing"}, sort_keys=True)]["busy"] is True
    assert results[json.dumps({"status": "executing"}, sort_keys=True)]["kind"] == "busy"
    assert results[json.dumps({"status": "thinking"}, sort_keys=True)]["busy"] is True
    assert results[json.dumps({"status": "thinking"}, sort_keys=True)]["kind"] == "busy"
    # running numeric flag still works.
    assert results[json.dumps({"running": 1}, sort_keys=True)]["busy"] is True
    # idle / offline must NOT be busy.
    assert results[json.dumps({"status": "idle"}, sort_keys=True)]["busy"] is False
    assert results[json.dumps({"status": "offline"}, sort_keys=True)]["busy"] is False


def test_orb_and_reasoning_wire_into_shared_agent_state_module():
    """orb.js + reasoning-web.js delegate status mapping to agent-state.js."""
    orb_js = (DASHBOARD / "orb.js").read_text(encoding="utf-8")
    graph_js = (DASHBOARD / "reasoning-web.js").read_text(encoding="utf-8")
    html = (DASHBOARD / "orb.html").read_text(encoding="utf-8")

    # Both files delegate to the shared module's global.
    assert "NiuAgentState" in orb_js
    assert ".isAgentBusy(agent)" in orb_js
    assert "NiuAgentState" in graph_js
    assert ".statusKind(agent)" in graph_js
    # The shared module is loaded before the consumers in the ORB shell.
    assert "/static/agent-state.js" in html
    # No stale inline allow-lists remain.
    assert "['running', 'processing', 'working']" not in orb_js
    assert "['running', 'processing', 'working']" not in graph_js


def test_docker_image_copies_the_served_dashboard_and_runtime_adapters():
    dockerfile = (ROOT / "Dockerfile").read_text(encoding="utf-8")
    assert "COPY dashboard/ ./dashboard/" in dockerfile
    assert "COPY modules/ ./modules/" in dockerfile
    assert "COPY swarm/ ./swarm/" in dockerfile


def test_upstream_notice_pins_reviewed_revision():
    notice = (ROOT / "THIRD_PARTY_NOTICES.md").read_text(encoding="utf-8")
    assert "RubenM1990/APEX-UI" in notice
    assert "f9fd176833a39b4634bad23cdc898fac4e0ab6a2" in notice
    assert "MIT License" in notice
