"""Static contract tests for the APEX-inspired Mission Core frontend."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DASHBOARD = ROOT / "dashboard"
FRONTEND = ROOT / "frontend"


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


def test_transition_frontend_copy_stays_in_sync():
    """dashboard/ is served today; frontend/ remains the v3 cutover copy."""
    for name in ("orb.html", "orb.js", "apex-adaptation.css", "reasoning-web.js"):
        assert (DASHBOARD / name).read_bytes() == (FRONTEND / name).read_bytes(), name


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
