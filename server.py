#!/usr/bin/env python3
"""Niu-MissionControl Dashboard Server."""
import http.server
import json
import os
import subprocess
import sys
import urllib.parse

# Setup Paths
MC_DIR = os.path.dirname(os.path.abspath(__file__))
SCRIPTS_DIR = os.path.join(MC_DIR, "scripts")
DASHBOARD_DIR = os.path.join(MC_DIR, "dashboard")
PORT = 5200

# Hardcoded Venv Paths for subprocess isolation issues
HERMES_VENV_PYTHON = os.path.join(MC_DIR, "venv", "bin", "python")
HERMES_VENV_SITE_PACKAGES = os.path.join(MC_DIR, "venv", "lib", "python3.14", "site-packages")

# Import other modules
# (These are placeholders since the files don't exist in the context)
# from modules.agent_log import get_recent, get_stats, get_tokens, log as log_activity
# from modules.content_db import get_all as get_all_content, get_by_agent
# from modules.hermes_bridge import send_chat, run_terminal

def _run_sculptor(image_path, obj_name, output_dir):
    """Run the sculptor wrapper with the correct Python environment."""
    try:
        script_path = os.path.join(SCRIPTS_DIR, "sculptor_wrapper.py")
        venv_python_path = os.path.join(MC_DIR, "venv", "bin", "python")
        venv_site_packages = os.path.join(MC_DIR, "venv", "lib", "python3.14", "site-packages")
        venv_path = os.path.join(MC_DIR, "venv") # Path to the venv root

        cmd = [venv_python_path, script_path, image_path, "--output", output_dir]
        if obj_name:
            cmd.extend(["--name", obj_name])
            
        env = os.environ.copy()
        
        # Explicitly set PYTHONPATH to include venv's site-packages
        # Prepend to existing PYTHONPATH to ensure venv packages are found first
        current_python_path = env.get('PYTHONPATH', '')
        if current_python_path:
            env['PYTHONPATH'] = f"{venv_site_packages}:{current_python_path}"
        else:
            env['PYTHONPATH'] = venv_site_packages
            
        # Explicitly set VIRTUAL_ENV
        env['VIRTUAL_ENV'] = venv_path

        r = subprocess.run(
            cmd, capture_output=True, text=True, timeout=120, cwd=MC_DIR, env=env, shell=False
        )

        if r.returncode == 0 and r.stdout:
            lines = r.stdout.strip().split('\n')
            for line in reversed(lines):
                if line.strip().startswith('{') and line.strip().endswith('}'):
                    try:
                        return json.loads(line)
                    except json.JSONDecodeError:
                        continue # Coba baris sebelumnya
            return {"status": "ok_no_json", "raw_output": r.stdout}
        else:
            return {"status": "error", "stderr": r.stderr}
    except Exception as e:
        return {"status": "error", "error": str(e)}

class MCHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        # Suppress non-API logs
        if "GET /api/" in str(args[0]) or "POST /api/" in str(args[0]):
            super().log_message(format, *args)
            
    def _send_json(self, data, status=200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data)
        except (TypeError, json.JSONDecodeError):
            self._send_json({"error": "Invalid POST data"}, 400)
            return
            
        path = self.path
        if path == "/api/mc/sculpt":
            img_data = data.get("image", "")
            obj_name = data.get("object_name", None)
            models_dir = os.path.join(DASHBOARD_DIR, "models")
            os.makedirs(models_dir, exist_ok=True)
            
            if img_data and os.path.exists(img_data):
                result = _run_sculptor(img_data, obj_name, models_dir)
                self._send_json(result)
            else:
                 self._send_json({"status": "error", "error": "Image path required and must exist"}, 400)
            return

        self._send_json({"error": f"API endpoint {path} not found"}, 404)

    def do_GET(self):
        if self.path == "/":
            self.path = "/index.html"
        
        # Serve API endpoints
        if self.path.startswith("/api/"):
            # Placeholder for GET APIs
            self._send_json({"error": f"GET API {self.path} not implemented"}, 404)
            return
        
        # Serve static files from dashboard
        try:
            return super().do_GET()
        except FileNotFoundError:
            self.send_error(404, "File Not Found")

    def translate_path(self, path):
        # Prevent directory traversal
        path = path.split('?',1)[0]
        path = path.split('#',1)[0]
        path = os.path.normpath(urllib.parse.unquote(path))
        words = path.split('/')
        words = filter(None, words)
        
        filepath = DASHBOARD_DIR
        for word in words:
            if os.path.dirname(word) or word in (os.curdir, os.pardir):
                continue
            filepath = os.path.join(filepath, word)
        return filepath

def main():
    os.chdir(MC_DIR)
    server_address = ("", PORT)
    httpd = http.server.HTTPServer(server_address, MCHandler)
    print(f"Server started on http://localhost:{PORT}")
    httpd.serve_forever()

if __name__ == '__main__':
    main()
