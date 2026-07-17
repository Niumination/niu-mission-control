#!/usr/bin/env python3
"""System health widget — outputs JSON."""
import json
import os
import shutil
import subprocess
import time

def run(cmd, timeout=10):
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return r.stdout.strip(), r.returncode
    except Exception as e:
        return str(e), -1

def get_uptime():
    out, _ = run(["sysctl", "-n", "kern.boottime"])
    if "sec" in out:
        try:
            # Extract epoch from: { sec = 123456, usec = 789 } 
            sec = int(out.split("sec = ")[1].split(",")[0])
            delta = time.time() - sec
            days = int(delta // 86400)
            hours = int((delta % 86400) // 3600)
            mins = int((delta % 3600) // 60)
            return f"{days}d {hours}h {mins}m"
        except:
            pass
    return out[:50]

def get_memory():
    """Parse vm_stat for usable memory info."""
    out, _ = run(["vm_stat"])
    pages = {}
    for line in out.split("\n"):
        if ":" in line:
            parts = line.split(":")
            if len(parts) == 2:
                key = parts[0].strip().lower().replace(" ", "_")
                try:
                    val = int(parts[1].strip().rstrip("."))
                    pages[key] = val
                except ValueError:
                    pass
    page_size = 16384  # macOS default
    free = pages.get("pages_free", 0) * page_size
    active = pages.get("pages_active", 0) * page_size
    wired = pages.get("pages_wired_down", 0) * page_size
    compressed = pages.get("pages_occupied_by_compressor", 0) * page_size
    total = free + active + wired + compressed
    free_gb = free / (1024**3)
    total_gb = total / (1024**3)
    return {
        "free_pages": pages.get("pages_free", 0),
        "free_gb": round(free_gb, 1),
        "total_gb": round(total_gb, 1),
        "active_gb": round(active / (1024**3), 1),
        "wired_gb": round(wired / (1024**3), 1),
        "compressed_gb": round(compressed / (1024**3), 1),
        "pressure": "ok" if free_gb > 2 else "warning" if free_gb > 0.5 else "critical"
    }

def get_disks():
    disks = []
    for path in ["/", "/Volumes/HermesAgent"]:
        try:
            usage = shutil.disk_usage(path)
            pct = round(usage.used / usage.total * 100, 1)
            free_gb = round(usage.free / (1024**3), 1)
            total_gb = round(usage.total / (1024**3), 1)
            disks.append({
                "mount": path,
                "total_gb": total_gb,
                "free_gb": free_gb,
                "used_pct": pct,
                "status": "ok" if pct < 80 else "warning" if pct < 90 else "critical"
            })
        except:
            pass
    return disks

def get_launchd_services():
    """Check key services."""
    out, _ = run(["launchctl", "list"])
    services = {}
    for key in ["hermes", "gateway", "herdr"]:
        services[key] = key in out.lower()
    return services

def get_cpu():
    out, _ = run(["top", "-l", "1", "-n", "0", "-s", "0"])
    for line in out.split("\n"):
        if "CPU usage" in line:
            return line
    return "unknown"

def main():
    disks = get_disks()
    memory = get_memory()
    services = get_launchd_services()
    uptime = get_uptime()

    # Overall health score
    health_score = 100
    for d in disks:
        if d["status"] == "critical":
            health_score -= 20
        elif d["status"] == "warning":
            health_score -= 10
    if memory["pressure"] == "critical":
        health_score -= 25
    elif memory["pressure"] == "warning":
        health_score -= 10
    if not services.get("hermes") and not services.get("gateway"):
        health_score -= 15
    if not services.get("herdr"):
        health_score -= 10

    print(json.dumps({
        "health_score": max(0, health_score),
        "uptime": uptime,
        "disks": disks,
        "memory": memory,
        "services": services,
        "hostname": os.uname().nodename,
        "os": f"macOS {os.uname().release}",
    }))

if __name__ == "__main__":
    main()
