#!/usr/bin/env python3
"""Niu-MissionControl Dashboard Server.
Serves MC dashboard HTML + API endpoints for widget data.
Port: 5200

Extended with P1 Data Layer: activity log, content library, token tracking.
"""
import http.server
import json
import os
import subprocess
import sys
import urllib.parse

MC_DIR = os.path.dirname(os.path.abspath(__file__))

# Modules P1: Data Layer
from modules.agent_log import get_recent, get_stats, get_tokens, log as log_activity
from modules.content_db import get_all as get_all_content, get_by_agent

SCRIPTS_DIR = os.path.join(MC_DIR, "scripts")
DASHBOARD_DIR = os.path.join(MC_DIR, "dashboard")
PORT = 5200


def run_aggregator():
    """Run the aggregator script and return JSON."""
    try:
        r = subprocess.run(
            ["bash", os.path.join(SCRIPTS_DIR, "aggregator.sh")],
            capture_output=True, text=True, timeout=30,
            cwd=MC_DIR
        )
        if r.returncode == 0:
            try:
                return json.loads(r.stdout)
            except json.JSONDecodeError as e:
                return {"status": "error", "error": f"JSON parse: {e}", "raw": r.stdout[:500]}
        else:
            return {"status": "error", "error": f"exit {r.returncode}", "stderr": r.stderr[:500]}
    except subprocess.TimeoutExpired:
        return {"status": "error", "error": "aggregator timed out"}
    except Exception as e:
        return {"status": "error", "error": str(e)}


def run_script(name):
    """Jalankan script Python dari scripts/ dan return parsed JSON."""
    try:
        r = subprocess.run(
            ["python3", os.path.join(SCRIPTS_DIR, name)],
            capture_output=True, text=True, timeout=15
        )
        if r.returncode == 0:
            try:
                return json.loads(r.stdout)
            except json.JSONDecodeError:
                return {"status": "ok", "raw": r.stdout[:500]}
        return {"status": "error", "error": f"exit {r.returncode}", "stderr": r.stderr[:200]}
    except subprocess.TimeoutExpired:
        return {"status": "error", "error": "timeout"}
    except Exception as e:
        return {"status": "error", "error": str(e)}


class MCHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP handler for Niu-MC dashboard + API."""

    def _send_json(self, data, status=200):
        """Helper: kirim response JSON dengan headers."""
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2).encode())

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # === EXISTING ENDPOINTS (tidak berubah) ===

        if path == "/api/mc/aggregated":
            self._send_json(run_aggregator())
            return

        if path == "/api/mc/system":
            self._send_json(run_script("get-system.py"))
            return

        if path == "/api/mc/agents":
            self._send_json(run_script("get-agents.py"))
            return

        if path == "/api/mc/cron":
            self._send_json(run_script("get-cron.py"))
            return

        if path == "/api/mc/projects":
            self._send_json(run_script("get-git.py"))
            return

        if path == "/api/mc/gateway":
            self._send_json(run_script("get-gateway.py"))
            return

        # === P1 BARU: Data Layer Endpoints ===

        if path == "/api/mc/activity":
            limit = int(urllib.parse.parse_qs(parsed.query).get("limit", [20])[0])
            self._send_json(get_recent(limit=limit))
            return

        if path == "/api/mc/activity/stats":
            self._send_json(get_stats())
            return

        if path == "/api/mc/tokens":
            self._send_json(get_tokens())
            return

        if path == "/api/mc/content":
            agent = urllib.parse.parse_qs(parsed.query).get("agent", [None])[0]
            if agent:
                self._send_json(get_by_agent(agent))
            else:
                self._send_json(get_all_content())
            return

        # Static files from dashboard/ directory
        if path == "/" or path == "":
            self.path = "/index.html"
        else:
            self.path = path

        return super().do_GET()

    def do_POST(self):
        """Handle POST requests (untuk fase selanjutnya: chat, cron/run)."""
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length > 0 else b"{}"
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        try:
            data = json.loads(body) if body else {}
        except json.JSONDecodeError:
            self._send_json({"error": "invalid JSON"}, 400)
            return

        # Chat endpoint (untuk Fase 4 nanti)
        if path == "/api/mc/chat":
            self._send_json({
                "status": "not_implemented",
                "message": "Chat endpoint akan tersedia di Fase 4."
            })
            return

        # Cron run (untuk Fase 4 nanti)
        if path.startswith("/api/mc/cron/run/"):
            self._send_json({
                "status": "not_implemented",
                "message": "Cron trigger akan tersedia di Fase 4."
            })
            return

        self._send_json({"error": "not found"}, 404)

    def translate_path(self, path):
        """Serve files from dashboard/ directory."""
        p = super().translate_path(path)
        rel = os.path.relpath(p, os.getcwd())
        if rel.startswith(".."):
            return os.path.join(DASHBOARD_DIR, os.path.basename(path) if path != "/" else "index.html")
        return os.path.join(DASHBOARD_DIR, rel)


def main():
    os.chdir(MC_DIR)
    server = http.server.HTTPServer(("", PORT), MCHandler)
    print(json.dumps({
        "service": "Niu-MissionControl Dashboard",
        "status": "running",
        "port": PORT,
        "url": f"http://localhost:{PORT}",
        "endpoints": {
            "existing": {
                "dashboard": f"http://localhost:{PORT}/",
                "aggregated": f"http://localhost:{PORT}/api/mc/aggregated",
                "system": f"http://localhost:{PORT}/api/mc/system",
                "agents": f"http://localhost:{PORT}/api/mc/agents",
                "cron": f"http://localhost:{PORT}/api/mc/cron",
                "projects": f"http://localhost:{PORT}/api/mc/projects",
                "gateway": f"http://localhost:{PORT}/api/mc/gateway",
            },
            "p1_baru": {
                "activity": f"http://localhost:{PORT}/api/mc/activity",
                "activity_stats": f"http://localhost:{PORT}/api/mc/activity/stats",
                "tokens": f"http://localhost:{PORT}/api/mc/tokens",
                "content": f"http://localhost:{PORT}/api/mc/content",
            }
        }
    }))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()


if __name__ == "__main__":
    main()
