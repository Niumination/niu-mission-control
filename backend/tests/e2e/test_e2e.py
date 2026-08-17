"""E2E tests — Playwright stub (Phase 5.9).

Requires: pip install playwright && playwright install chromium

Usage:
    cd backend
    PLAYWRIGHT_BROWSERS_PATH=0 python -m pytest tests/e2e/ -v
"""
import subprocess
import sys

import pytest


def playwright_available():
    """Check if Playwright is installed."""
    try:
        result = subprocess.run(
            [sys.executable, "-c", "import playwright"],
            capture_output=True, timeout=5,
        )
        return result.returncode == 0
    except Exception:
        return False


pytestmark = pytest.mark.skipif(
    not playwright_available(),
    reason="Playwright not installed. Run: pip install playwright && playwright install chromium"
)


@pytest.mark.asyncio
async def test_dashboard_loads():
    """Dashboard loads at localhost:5200."""
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto("http://localhost:5200")
        title = await page.title()
        assert "MISSION CONTROL" in title.upper() or "HERMES" in title.upper()
        await browser.close()


@pytest.mark.asyncio
async def test_health_endpoint():
    """Health endpoint returns ok."""
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        response = await page.goto("http://localhost:5200/health")
        assert response.status == 200
        body = await response.json()
        assert body["status"] == "ok"
        await browser.close()
