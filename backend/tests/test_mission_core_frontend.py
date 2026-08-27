"""Static contract tests for the APEX-MC minimalist Mission Control frontend.

The redesign (PR#10) replaced the 12-page dashboard with a single orb view:
- dashboard/index.html  (orb core + reasoning graph + overview HUD + status bar)
- dashboard/orb.css     (vanilla, reduced-motion safe)
- dashboard/orb.js      (live data: /api/mc/hermes, /ecosystem, /skills)
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DASHBOARD = ROOT / "dashboard"


def test_orb_view_assets_are_wired():
    """index.html must load the orb layers (css + js)."""
    html = (DASHBOARD / "index.html").read_text(encoding="utf-8")

    assert 'id="orb-stage"' in html
    assert 'id="nodes"' in html
    assert 'id="overview"' in html
    assert 'id="statusbar"' in html
    assert 'href="/static/orb.css' in html
    assert 'src="/static/orb.js' in html

    for name in ("orb.css", "orb.js"):
        assert (DASHBOARD / name).is_file(), f"missing dashboard/{name}"


def test_orb_uses_real_niu_telemetry_contracts():
    """orb.js must pull live Niumination state, not APEX demo data."""
    orb_js = (DASHBOARD / "orb.js").read_text(encoding="utf-8")

    # Live endpoints (from existing backend).
    assert '"/api/mc/hermes"' in orb_js
    assert '"/api/mc/ecosystem' in orb_js
    assert '"/api/mc/skills/stats"' in orb_js

    # No APEX demo roster leakage.
    assert "chief_of_staff" not in orb_js
    assert "social_media" not in orb_js
    # Trio + ecosystem nodes (not 18 APEX agents).
    for key in ("hermes", "jcode", "opencode", "apps", "services", "sites", "skills"):
        assert f'key: "{key}"' in orb_js


def test_reduced_motion_and_accessible_controls_are_present():
    css = (DASHBOARD / "orb.css").read_text(encoding="utf-8")
    html = (DASHBOARD / "index.html").read_text(encoding="utf-8")
    js = (DASHBOARD / "orb.js").read_text(encoding="utf-8")

    # Mac REDUCE-MOTION ON: respect user preference.
    assert "prefers-reduced-motion: reduce" in css
    # A11y: visually-hidden nav for keyboard / screen readers.
    assert 'class="visually-hidden"' in html
    assert 'aria-live="polite"' in html
    # Escape closes the agent card.
    assert 'e.key === "Escape"' in js


def test_orb_state_machine_is_wired():
    """orb.js must implement idle/thinking/speaking driven by real Hermes state."""
    js = (DASHBOARD / "orb.js").read_text(encoding="utf-8")
    for state in ("thinking", "speaking", "idle"):
        assert f'"{state}"' in js
    # Tap-to-energize interaction.
    assert "boost" in js
    assert "orb-tap" in js


def test_docker_image_copies_served_dashboard():
    dockerfile = (ROOT / "Dockerfile").read_text(encoding="utf-8")
    assert "COPY dashboard/ ./dashboard/" in dockerfile
    assert "COPY modules/ ./modules/" in dockerfile
    # server.py is part of the build context (produksi launchd runs `python server.py`);
    # the Docker image need not COPY it explicitly as long as the context includes it.
    assert (ROOT / "server.py").is_file()


def test_upstream_notice_pins_reviewed_revision():
    notice = (ROOT / "THIRD_PARTY_NOTICES.md").read_text(encoding="utf-8")
    assert "RubenM1990/APEX-UI" in notice
    assert "MIT License" in notice
