"""
Ecosystem Scanner — Scan seluruh Niumination project dari filesystem
=====================================================================

Data sources:
- Production/ dan projects/ directories (filesystem scan)
- Git metadata (branch, last commit, dirty, remote)
- LaunchD plist files (macOS cron jobs)
- BACKLOG.md (task counts)

Output: JSON untuk /api/mc/ecosystem endpoint
"""

from __future__ import annotations

import os
import re
import subprocess
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from typing import Any

WIB = timezone(timedelta(hours=7))
NIUMINATION = "/Users/zaryu/Desktop/Niumination"
LAUNCH_AGENTS = os.path.expanduser("~/Library/LaunchAgents")

# Directories to scan
SCAN_DIRS = {
    "Production": os.path.join(NIUMINATION, "Production"),
    "projects": os.path.join(NIUMINATION, "projects"),
}

# Ignore patterns
IGNORE_DIRS = {".git", "node_modules", "__pycache__", ".next", ".DS_Store"}

# Deploy URL patterns (detected from directory name)
DEPLOY_MAP = {
    "PemdiAcehTengah": "https://pemdi-aceh-tengah.vercel.app",
    "kune-ya.com": "https://kune-ya-com.vercel.app",
    "niu-vermilion": "https://niu-vermilion.vercel.app",
    "Niu-LKH": "https://niumination.github.io/Niu-LKH",
    "niu-dash": "https://niumination.github.io/niu-dash",
    "AuditTI-AT": "https://niumination.github.io/AuditTI-AT",
    "arch-web-dashboard": "https://github.com/Niumination/arch-web-dashboard",
    "mac-web-dashboard": "https://github.com/Niumination/mac-web-dashboard",
    "ai-file-manager-android": "https://github.com/Niumination/ai-file-organizer-android",
}


def _git_cmd(cwd: str, *args: str) -> str:
    """Run a git command and return stdout, or empty string on failure."""
    try:
        r = subprocess.run(
            ["git", *args],
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=5,
        )
        return r.stdout.strip()
    except Exception:
        return ""


def _get_git_info(project_path: str) -> dict[str, Any]:
    """Extract git metadata from a project directory."""
    if not os.path.isdir(os.path.join(project_path, ".git")):
        return {"is_git": False}

    branch = _git_cmd(project_path, "branch", "--show-current")
    last_commit_msg = _git_cmd(project_path, "log", "-1", "--pretty=%s")
    last_commit_date = _git_cmd(project_path, "log", "-1", "--pretty=%ci")
    last_commit_hash = _git_cmd(project_path, "log", "-1", "--pretty=%h")
    dirty = bool(_git_cmd(project_path, "status", "--porcelain"))
    unpushed = _git_cmd(project_path, "log", f"origin/{branch}..HEAD", "--oneline") if branch else ""
    unpushed_count = len(unpushed.splitlines()) if unpushed else 0
    remote_url = _git_cmd(project_path, "remote", "get-url", "origin")

    # Parse date
    last_commit_dt = None
    if last_commit_date:
        try:
            last_commit_dt = datetime.fromisoformat(last_commit_date.replace(" ", "T", 1)).isoformat()
        except Exception:
            last_commit_dt = last_commit_date

    return {
        "is_git": True,
        "branch": branch or "unknown",
        "last_commit": {
            "hash": last_commit_hash,
            "message": last_commit_msg[:100],
            "date": last_commit_dt,
        },
        "dirty": dirty,
        "unpushed_count": unpushed_count,
        "remote_url": remote_url,
    }


def scan_projects() -> list[dict[str, Any]]:
    """Scan Production/ and projects/ directories for all projects."""
    projects = []

    for category, base_path in SCAN_DIRS.items():
        if not os.path.isdir(base_path):
            continue

        for name in sorted(os.listdir(base_path)):
            if name.startswith(".") or name in IGNORE_DIRS:
                continue

            project_path = os.path.join(base_path, name)
            if not os.path.isdir(project_path):
                continue

            git_info = _get_git_info(project_path)
            deploy_url = DEPLOY_MAP.get(name)
            has_agents_md = os.path.isfile(os.path.join(project_path, "AGENTS.md"))

            # Determine status
            if category == "Production":
                status_label = "production"
            elif git_info.get("dirty"):
                status_label = "active"
            elif git_info.get("unpushed_count", 0) > 0:
                status_label = "needs_push"
            else:
                status_label = "stable"

            projects.append({
                "name": name,
                "category": category,
                "status": status_label,
                "deploy_url": deploy_url,
                "has_dox": has_agents_md,
                **git_info,
            })

    return projects


def scan_launchd_cron() -> list[dict[str, Any]]:
    """Scan ~/Library/LaunchAgents/com.niumination.*.plist for cron jobs."""
    jobs = []

    if not os.path.isdir(LAUNCH_AGENTS):
        return jobs

    for fname in sorted(os.listdir(LAUNCH_AGENTS)):
        if not fname.startswith("com.niumination.") or not fname.endswith(".plist"):
            continue

        plist_path = os.path.join(LAUNCH_AGENTS, fname)
        try:
            tree = ET.parse(plist_path)
            root = tree.getroot()

            # Parse plist dict
            plist_data = _parse_plist_dict(root)

            label = plist_data.get("Label", fname.replace(".plist", ""))
            program_args = plist_data.get("ProgramArguments", [])
            program = program_args[0] if program_args else ""
            args = " ".join(program_args[1:]) if len(program_args) > 1 else ""

            # Schedule
            interval = plist_data.get("StartInterval")
            calendar = plist_data.get("StartCalendarInterval")
            keep_alive = plist_data.get("KeepAlive", False)

            schedule_str = "unknown"
            interval_seconds = 0
            if interval:
                interval_seconds = int(interval)
                if interval_seconds >= 604800:
                    schedule_str = f"every {interval_seconds // 604800} week(s)"
                elif interval_seconds >= 86400:
                    schedule_str = f"every {interval_seconds // 86400} day(s)"
                elif interval_seconds >= 3600:
                    schedule_str = f"every {interval_seconds // 3600} hour(s)"
                elif interval_seconds >= 60:
                    schedule_str = f"every {interval_seconds // 60} min(s)"
                else:
                    schedule_str = f"every {interval_seconds}s"
            elif calendar:
                if isinstance(calendar, list):
                    cal = calendar[0] if calendar else {}
                else:
                    cal = calendar
                hour = cal.get("Hour", "?")
                minute = cal.get("Minute", "?")
                weekday = cal.get("Weekday")
                day = cal.get("Day")
                if weekday is not None:
                    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
                    schedule_str = f"{day_names[int(weekday)]} {hour}:{minute:02d}"
                elif day is not None:
                    schedule_str = f"day {day} at {hour}:{minute:02d}"
                else:
                    schedule_str = f"daily at {hour}:{minute:02d}"

            # Status
            if keep_alive:
                status = "running"
            else:
                status = "scheduled"

            # Last run (from stdout log if exists)
            last_run = _get_last_launchd_run(label)

            jobs.append({
                "label": label,
                "program": program,
                "args": args[:120],
                "schedule": schedule_str,
                "interval_seconds": interval_seconds,
                "status": status,
                "keep_alive": keep_alive,
                "last_run": last_run,
                "plist_file": fname,
            })

        except Exception as e:
            jobs.append({
                "label": fname,
                "error": str(e)[:100],
                "status": "error",
            })

    return jobs


def _parse_plist_dict(root: ET.Element) -> dict:
    """Parse Apple plist XML into a Python dict."""
    result = {}
    plist_dict = root.find("dict")
    if plist_dict is None:
        return result

    keys = plist_dict.findall("key")
    values = list(plist_dict)

    key_idx = 0
    for elem in values:
        if elem.tag == "key":
            key_name = elem.text or ""
            # Find the next sibling (value)
            key_idx += 1
            if key_idx < len(values):
                val_elem = values[key_idx]
                result[key_name] = _parse_plist_value(val_elem)
            key_idx += 1

    return result


def _parse_plist_value(elem: ET.Element) -> Any:
    """Parse a single plist value element."""
    if elem.tag == "string":
        return elem.text or ""
    elif elem.tag == "integer":
        return int(elem.text or "0")
    elif elem.tag == "true":
        return True
    elif elem.tag == "false":
        return False
    elif elem.tag == "dict":
        return _parse_plist_dict_from_elem(elem)
    elif elem.tag == "array":
        return [_parse_plist_value(child) for child in elem]
    return elem.text or ""


def _parse_plist_dict_from_elem(elem: ET.Element) -> dict:
    """Parse a dict element directly."""
    result = {}
    children = list(elem)
    i = 0
    while i < len(children):
        if children[i].tag == "key":
            key = children[i].text or ""
            if i + 1 < len(children):
                result[key] = _parse_plist_value(children[i + 1])
                i += 2
            else:
                i += 1
        else:
            i += 1
    return result


def _get_last_launchd_run(label: str) -> str | None:
    """Try to get last run time from launchd log."""
    log_path = os.path.expanduser(f"~/Library/Logs/{label}.log")
    if os.path.isfile(log_path):
        try:
            mtime = os.path.getmtime(log_path)
            return datetime.fromtimestamp(mtime, tz=WIB).isoformat()
        except Exception:
            pass

    # Check standard launchd output location
    for log_dir in ["/tmp", os.path.expanduser("~/Library/Logs")]:
        for ext in [".out", ".log", ".err"]:
            path = os.path.join(log_dir, f"{label}{ext}")
            if os.path.isfile(path):
                try:
                    mtime = os.path.getmtime(path)
                    return datetime.fromtimestamp(mtime, tz=WIB).isoformat()
                except Exception:
                    pass
    return None


def get_git_activity(limit_per_repo: int = 3) -> list[dict[str, Any]]:
    """Get recent git commits across all repos."""
    repos = []

    for category, base_path in SCAN_DIRS.items():
        if not os.path.isdir(base_path):
            continue

        for name in sorted(os.listdir(base_path)):
            if name.startswith(".") or name in IGNORE_DIRS:
                continue

            project_path = os.path.join(base_path, name)
            if not os.path.isdir(os.path.join(project_path, ".git")):
                continue

            # Recent commits
            log_output = _git_cmd(
                project_path, "log",
                f"--max-count={limit_per_repo}",
                "--pretty=format:%h|%s|%ci|%an",
            )

            commits = []
            if log_output:
                for line in log_output.splitlines():
                    parts = line.split("|", 3)
                    if len(parts) >= 3:
                        commits.append({
                            "hash": parts[0],
                            "message": parts[1][:100],
                            "date": parts[2].strip(),
                            "author": parts[3] if len(parts) > 3 else "unknown",
                        })

            if commits:
                repos.append({
                    "name": name,
                    "category": category,
                    "commits": commits,
                })

    # Sort by most recent commit date
    repos.sort(
        key=lambda r: r["commits"][0]["date"] if r["commits"] else "",
        reverse=True,
    )

    return repos


def get_backlog_summary() -> dict[str, Any]:
    """Parse BACKLOG.md for task counts."""
    backlog_path = os.path.join(NIUMINATION, "BACKLOG.md")
    if not os.path.isfile(backlog_path):
        return {"total": 0, "done": 0, "active": 0, "todo": 0}

    try:
        with open(backlog_path, "r") as f:
            content = f.read()

        tasks = re.findall(r"^- \[(.)\]", content, re.MULTILINE)
        total = len(tasks)
        done = sum(1 for t in tasks if t == "x")
        active = sum(1 for t in tasks if t == "~")
        todo = sum(1 for t in tasks if t == " ")
        cancelled = sum(1 for t in tasks if t == "-")

        p1 = len(re.findall(r"^- \[.\] .*P1", content, re.MULTILINE))
        p2 = len(re.findall(r"^- \[.\] .*P2", content, re.MULTILINE))
        p3 = len(re.findall(r"^- \[.\] .*P3", content, re.MULTILINE))

        return {
            "total": total,
            "done": done,
            "active": active,
            "todo": todo,
            "cancelled": cancelled,
            "p1": p1,
            "p2": p2,
            "p3": p3,
        }
    except Exception:
        return {"total": 0, "done": 0, "active": 0, "todo": 0}


def get_full_ecosystem() -> dict[str, Any]:
    """Aggregate all ecosystem data into a single response."""
    timestamp = datetime.now(WIB).isoformat()

    return {
        "timestamp": timestamp,
        "projects": scan_projects(),
        "cron_jobs": scan_launchd_cron(),
        "git_activity": get_git_activity(limit_per_repo=3),
        "backlog": get_backlog_summary(),
    }
