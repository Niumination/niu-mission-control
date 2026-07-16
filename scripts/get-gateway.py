#!/usr/bin/env python3
"""Gateway health widget — outputs JSON."""
import json
import subprocess
import os

def run(cmd, timeout=10):
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return r.stdout.strip(), r.returncode
    except Exception as e:
        return str(e), -1

def main():
    # launchd status
    out, code = run(["launchctl", "list"])
    lines = out.split('\n')
    gw_lines = [l for l in lines if 'hermes' in l.lower() or 'gateway' in l.lower()]

    # Gateway lock file
    gw_lock = "/Users/zaryu/.hermes/gateway.lock"
    gw_state = "/Users/zaryu/.hermes/gateway_state.json"
    lock_info = {}
    state_info = {}
    if os.path.exists(gw_lock):
        try:
            with open(gw_lock) as f:
                lock_info["content"] = f.read().strip()
            lock_info["exists"] = True
        except:
            lock_info["error"] = "cannot read"
    else:
        lock_info["exists"] = False

    if os.path.exists(gw_state):
        try:
            import json as j
            with open(gw_state) as f:
                state_info = j.load(f)
        except:
            state_info = {"error": "cannot parse"}

    # Gateway log tail
    log_path = "/Volumes/HermesAgent/HermesAgentUSB/data/logs/gateway.error.log"
    log_tail = ""
    if os.path.exists(log_path):
        try:
            with open(log_path) as f:
                lines = f.readlines()
                log_tail = "".join(lines[-30:])
        except:
            log_tail = "cannot read"

    print(json.dumps({
        "launchd_status": {
            "gateway_lines": gw_lines,
            "gateway_running": len(gw_lines) > 0,
        },
        "gateway_lock": lock_info,
        "gateway_state": state_info,
        "gateway_log_tail": log_tail[-500:],
    }))

if __name__ == "__main__":
    main()
