#!/usr/bin/env python3
"""Herdr agent status widget — outputs JSON."""
import json
import subprocess
import sys
import os

HOME = "/Users/zaryu"
ENV = os.environ.copy()
ENV["HOME"] = HOME

def run(cmd):
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=15, env=ENV)
        return r.stdout.strip(), r.returncode
    except subprocess.TimeoutExpired:
        return "TIMEOUT", -1
    except FileNotFoundError:
        return "NOT_FOUND", -2

def main():
    # Check herdr status
    out, code = run(["herdr", "status"])
    if code != 0:
        # Try with full path
        out, code = run(["/opt/homebrew/bin/herdr", "status"])

    if code != 0:
        print(json.dumps({
            "status": "error",
            "error": f"herdr not reachable (exit {code})",
            "hint": "Try: ln -sf /Users/zaryu/.config/herdr/herdr.sock $HOME/.config/herdr/herdr.sock",
            "agents": []
        }))
        return

    # Get agent list
    out2, code2 = run(["herdr", "agent", "list"])
    if code2 != 0:
        out2, code2 = run(["/opt/homebrew/bin/herdr", "agent", "list"])

    agents = []
    try:
        data = json.loads(out2)
        raw = data.get("result", {}).get("agents", [])
        for a in raw:
            agents.append({
                "name": a.get("name", "?"),
                "status": a.get("info", {}).get("status", a.get("status", "unknown")),
                "tab": a.get("tab_label", ""),
                "pane": a.get("pane_id", ""),
            })
    except (json.JSONDecodeError, AttributeError):
        agents = [{"name": "parse-error", "status": "unknown", "raw": out2[:200]}]

    # Gateway status
    gw_out, _ = run(["launchctl", "list"])
    gw_running = "hermes" in gw_out or "gateway" in gw_out

    print(json.dumps({
        "status": "ok",
        "herdr_connected": True,
        "gateway_running": gw_running,
        "agent_count": len(agents),
        "agents": agents,
    }))

if __name__ == "__main__":
    main()
