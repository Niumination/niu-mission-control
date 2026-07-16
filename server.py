#!/usr/bin/env python3
"""Niu-MissionControl Dashboard Server.
Serves MC dashboard HTML + API endpoints for widget data.
Port: 5200
"""
import http.server
import json
import os
import subprocess
import urllib.parse

MC_DIR = os.path.dirname(os.path.abspath(__file__))
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


class MCHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # API endpoints
        if path == "/api/mc/aggregated":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            data = run_aggregator()
            self.wfile.write(json.dumps(data, indent=2).encode())
            return

        if path == "/api/mc/agents":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            r = subprocess.run(["python3", os.path.join(SCRIPTS_DIR, "get-agents.py")],
                              capture_output=True, text=True, timeout=15)
            self.wfile.write(r.stdout.encode() if r.returncode == 0 else b'{"error":"failed"}')
            return

        if path == "/api/mc/cron":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            r = subprocess.run(["python3", os.path.join(SCRIPTS_DIR, "get-cron.py")],
                              capture_output=True, text=True, timeout=15)
            self.wfile.write(r.stdout.encode() if r.returncode == 0 else b'{"error":"failed"}')
            return

        if path == "/api/mc/projects":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            r = subprocess.run(["python3", os.path.join(SCRIPTS_DIR, "get-git.py")],
                              capture_output=True, text=True, timeout=15)
            self.wfile.write(r.stdout.encode() if r.returncode == 0 else b'{"error":"failed"}')
            return

        if path == "/api/mc/gateway":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            r = subprocess.run(["python3", os.path.join(SCRIPTS_DIR, "get-gateway.py")],
                              capture_output=True, text=True, timeout=15)
            self.wfile.write(r.stdout.encode() if r.returncode == 0 else b'{"error":"failed"}')
            return

        # Static files from dashboard/ directory
        if path == "/" or path == "":
            self.path = "/index.html"
        else:
            self.path = path

        # Serve from dashboard/ directory
        return super().do_GET()

    def translate_path(self, path):
        """Serve files from dashboard/ directory."""
        # Default translation
        p = super().translate_path(path)
        # Redirect to dashboard dir
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
            "dashboard": f"http://localhost:{PORT}/",
            "aggregated": f"http://localhost:{PORT}/api/mc/aggregated",
            "agents": f"http://localhost:{PORT}/api/mc/agents",
            "cron": f"http://localhost:{PORT}/api/mc/cron",
            "projects": f"http://localhost:{PORT}/api/mc/projects",
            "gateway": f"http://localhost:{PORT}/api/mc/gateway",
        }
    }))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()


if __name__ == "__main__":
    main()
