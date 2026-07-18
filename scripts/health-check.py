#!/usr/bin/env python3
"""
Niu-MissionControl Health Checker
Runs periodically to check system health.
Silent when healthy — reports only when issues found.
"""
import json
import os
import subprocess
import shutil

HOME = "/Users/zaryu"
ENV = {**os.environ, "HOME": HOME}
ISSUES = []

def run(cmd, timeout=10):
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, env=ENV)
        return r.stdout.strip(), r.returncode
    except Exception as e:
        return str(e), -1

def check_disk():
    """Check disk usage on main volumes."""
    for path in ["/", "/Volumes/HermesAgent"]:
        try:
            usage = shutil.disk_usage(path)
            pct = usage.used / usage.total * 100
            free_gb = usage.free / (1024**3)
            if pct > 85:
                ISSUES.append(f"⚠️ Disk {path}: {pct:.0f}% used ({free_gb:.1f}GB free)")
        except:
            pass

def check_memory():
    """Check memory pressure."""
    out, _ = run(["vm_stat"])
    if "page" in out.lower():
        # Parse vm_stat for memory pressure
        lines = out.split('\n')
        for line in lines:
            if "free" in line.lower() and "page" in line.lower():
                try:
                    val = int(line.split(':')[1].strip().rstrip('.'))
                    if val < 100000:
                        ISSUES.append(f"⚠️ Low free memory: {val} pages free")
                except:
                    pass

def check_gateway():
    """Check if gateway is running via launchd."""
    out, _ = run(["launchctl", "list"])
    if "hermes" not in out.lower() and "gateway" not in out.lower():
        ISSUES.append("🔴 Gateway not running in launchd")

def check_mc_server():
    """Check MC dashboard server."""
    out, code = run(["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "http://localhost:5200/"], timeout=5)
    if code != 0 or out != "200":
        ISSUES.append("🔴 MC Dashboard (port 5200) not responding")

def check_kanban():
    """Check kanban dashboard server."""
    out, code = run(["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "http://localhost:5199/"], timeout=5)
    if code != 0 or out != "200":
        ISSUES.append("🔴 Kanban Dashboard (port 5199) not responding")

def check_agents():
    """Check agent fleet status."""
    out, code = run(["herdr", "agent", "list"])
    if code != 0:
        ISSUES.append("⚠️ herdr not accessible")
        return
    try:
        data = json.loads(out)
        agents = data.get("result", {}).get("agents", [])
        expected = {"builder", "pengawas", "arsitek", "penjaga"}
        found = {a.get("name") for a in agents}
        missing = expected - found
        if missing:
            ISSUES.append(f"⚠️ Agents missing: {', '.join(sorted(missing))}")
    except json.JSONDecodeError:
        ISSUES.append("⚠️ herdr agent list unparseable")

def check_cron():
    """Check if MC-specific cron jobs exist and state."""
    out, code = run(["cronjob", "action=list"], timeout=10)
    if code == 0 and "health-check" not in out and "mc-health" not in out:
        pass  # This IS the health check, so it's expected
    # Check state.db for cron entries
    state_db = os.path.expanduser("~/.hermes/state.db")
    if os.path.exists(state_db):
        try:
            import sqlite3
            db = sqlite3.connect(state_db)
            cursor = db.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [r[0] for r in cursor.fetchall()]
            if "schedules" not in tables and "cron_jobs" not in tables:
                ISSUES.append("⚠️ No cron tables in state.db")
            db.close()
        except Exception as e:
            ISSUES.append(f"⚠️ state.db error: {e}")

def main():
    check_disk()
    check_memory()
    check_gateway()
    check_mc_server()
    check_kanban()
    check_agents()
    check_cron()

    if not ISSUES:
        # Silent exit — no news is good news
        return

    print("🏥 Niu-MissionControl Health Check")
    print(f"📅 {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M WIB')}")
    print()
    for issue in ISSUES:
        print(issue)

    # Summary
    critical = sum(1 for i in ISSUES if i.startswith("🔴"))
    warnings = sum(1 for i in ISSUES if i.startswith("⚠️"))
    print()
    print(f"Summary: {len(ISSUES)} issue(s) — {critical} critical, {warnings} warning")
    print("Action needed ⬆️")

if __name__ == "__main__":
    main()
