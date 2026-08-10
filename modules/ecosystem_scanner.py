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
import time
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
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

# ── Cache (avoid re-scanning on every request) ──────────
_cache: dict[str, Any] = {}
_cache_time: dict[str, float] = {}
CACHE_TTL = 30  # seconds

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




def _parse_git_date(date_str: str) -> datetime:
    """Parse git date string with multiple format support.

    Git --pretty=%ci outputs: 2026-07-30 14:30:45 +0700
    Git --pretty=%cI outputs: 2026-07-30T14:30:45+07:00
    """
    date_str = date_str.strip()

    # Try ISO format first (git --pretty=%cI)
    try:
        return datetime.fromisoformat(date_str)
    except Exception:
        pass

    # Try git default format: 2026-07-30 14:30:45 +0700
    try:
        if " " in date_str:
            dt_part, tz_part = date_str.rsplit(" ", 1)
            if len(tz_part) == 5 and tz_part[0] in "+-":
                tz_part = tz_part[:3] + ":" + tz_part[3:]
                date_str = f"{dt_part}T{tz_part}"
        return datetime.fromisoformat(date_str)
    except Exception:
        pass

    # Fallback: try parsing just the date part
    try:
        return datetime.fromisoformat(date_str.split()[0])
    except Exception:
        pass

    return datetime.now(timezone.utc)


def _detect_deploy_url(project_path: str) -> str | None:
    """Auto-detect deploy URL from project config files."""
    # Check vercel.json
    vercel_path = os.path.join(project_path, "vercel.json")
    if os.path.isfile(vercel_path):
        try:
            with open(vercel_path, "r") as f:
                import json
                data = json.load(f)
                if "alias" in data:
                    aliases = data["alias"]
                    if isinstance(aliases, list) and aliases:
                        return f"https://{aliases[0]}"
                    elif isinstance(aliases, str):
                        return f"https://{aliases}"
                if "domains" in data:
                    domains = data["domains"]
                    if isinstance(domains, list) and domains:
                        return f"https://{domains[0]}"
        except Exception:
            pass

    # Check netlify.toml
    netlify_path = os.path.join(project_path, "netlify.toml")
    if os.path.isfile(netlify_path):
        try:
            import tomllib
            with open(netlify_path, "rb") as f:
                data = tomllib.load(f)
        except Exception:
            pass

    # Check package.json for homepage or repository
    package_path = os.path.join(project_path, "package.json")
    if os.path.isfile(package_path):
        try:
            with open(package_path, "r") as f:
                import json
                data = json.load(f)
                if "homepage" in data and data["homepage"]:
                    return data["homepage"]
                if "repository" in data:
                    repo = data["repository"]
                    if isinstance(repo, dict) and "url" in repo:
                        url = repo["url"]
                        if "github.com" in url:
                            url = url.replace("git@", "https://").replace(".git", "")
                            if url.startswith("https://github.com/"):
                                return url
        except Exception:
            pass

    # Check for .vercel/output or .netlify directories
    if os.path.isdir(os.path.join(project_path, ".vercel")):
        return "vercel-deployed"
    if os.path.isdir(os.path.join(project_path, ".netlify")):
        return "netlify-deployed"

    return None


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
    """ all git commands in one subprocess for speed."""
    if not os.path.isdir(os.path.join(project_path, ".git")):
        return {"is_git": False}

    try:
        # Single shell command with cd for cwd
        cmd = f'cd {project_path} && git log -1 --pretty="%D|%h|%s|%ci" 2>/dev/null; echo "---"; git status --porcelain 2>/dev/null; echo "---"; git remote get-url origin 2>/dev/null'
        output = os.popen(cmd).read()
    except Exception:
        return {"is_git": True, "branch": "unknown", "last_commit": {"hash": "", "message": "", "date": ""}, "dirty": False, "remote_url": ""}

    sections = output.split("---\n")
    log_line = sections[0].strip() if sections else ""
    status_lines = sections[1].strip() if len(sections) > 1 else ""
    remote_url = sections[2].strip() if len(sections) > 2 else ""

    dirty = bool(status_lines)
    branch = ""
    last_commit = {"hash": "", "message": "", "date": ""}

    if log_line:
        parts = log_line.split("|", 3)
        if len(parts) >= 4:
            refs = parts[0].strip()
            short_hash = parts[1]
            message = parts[2]
            date_str = parts[3].strip()

            branch_match = re.search(r"HEAD -> (\S+)", refs)
            if branch_match:
                branch = branch_match.group(1).rstrip(",")
            elif "origin/" in refs:
                om = re.search(r"origin/(\S+)", refs)
                if om:
                    branch = om.group(1).rstrip(",")

            try:
                last_commit_dt = _parse_git_date(date_str).isoformat()
            except Exception:
                last_commit_dt = date_str

            last_commit = {
                "hash": short_hash,
                "message": message[:100],
                "date": last_commit_dt,
            }

    return {
        "is_git": True,
        "branch": branch or "unknown",
        "last_commit": last_commit,
        "dirty": dirty,
        "remote_url": remote_url,
    }


def _scan_single_project(category: str, name: str, project_path: str) -> dict[str, Any]:
    """Scan a single project — runs in thread pool."""
    git_info = _get_git_info(project_path)
    # Try auto-detect first, fallback to DEPLOY_MAP\n    deploy_url = _detect_deploy_url(project_path) or DEPLOY_MAP.get(name)
    has_agents_md = os.path.isfile(os.path.join(project_path, "AGENTS.md"))

    if category == "Production":
        status_label = "production"
    elif git_info.get("dirty"):
        status_label = "active"
    else:
        status_label = "stable"

    return {
        "name": name,
        "category": category,
        "status": status_label,
        "deploy_url": deploy_url,
        "has_dox": has_agents_md,
        **git_info,
    }


def scan_projects() -> list[dict[str, Any]]:
    """Scan Production/ and projects/ directories — parallelized."""
    now = time.time()
    if "projects" in _cache and (now - _cache_time.get("projects", 0)) < CACHE_TTL:
        return _cache["projects"]

    tasks = []
    for category, base_path in SCAN_DIRS.items():
        if not os.path.isdir(base_path):
            continue
        for name in sorted(os.listdir(base_path)):
            if name.startswith(".") or name in IGNORE_DIRS:
                continue
            project_path = os.path.join(base_path, name)
            if not os.path.isdir(project_path):
                continue
            tasks.append((category, name, project_path))

    # Parallel git scans (30 repos concurrently)
    projects = []
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {
            executor.submit(_scan_single_project, cat, name, path): name
            for cat, name, path in tasks
        }
        for future in as_completed(futures):
            try:
                projects.append(future.result())
            except Exception:
                pass

    # Sort: Production first, then alphabetical
    projects.sort(key=lambda p: (0 if p["category"] == "Production" else 1, p["name"]))

    _cache["projects"] = projects
    _cache_time["projects"] = now
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


def _scan_single_repo_git(name: str, category: str, project_path: str, limit: int) -> dict[str, Any] | None:
    """Get git activity for a single repo — runs in thread pool."""
    if not os.path.isdir(os.path.join(project_path, ".git")):
        return None

    try:
        cmd = f'cd {project_path} && git log -{limit} --pretty="%h|%s|%ci|%an" 2>/dev/null'
        output = os.popen(cmd).read()
    except Exception:
        return None

    commits = []
    if output:
        for line in output.splitlines():
            parts = line.split("|", 3)
            if len(parts) >= 3:
                commits.append({
                    "hash": parts[0],
                    "message": parts[1][:100],
                    "date": parts[2].strip(),
                    "author": parts[3] if len(parts) > 3 else "unknown",
                })

    if commits:
        return {"name": name, "category": category, "commits": commits}
    return None


def get_git_activity(limit_per_repo: int = 3) -> list[dict[str, Any]]:
    """Get recent git commits across all repos — parallelized."""
    now = time.time()
    if "git" in _cache and (now - _cache_time.get("git", 0)) < CACHE_TTL:
        return _cache["git"]

    tasks = []
    for category, base_path in SCAN_DIRS.items():
        if not os.path.isdir(base_path):
            continue
        for name in sorted(os.listdir(base_path)):
            if name.startswith(".") or name in IGNORE_DIRS:
                continue
            project_path = os.path.join(base_path, name)
            if os.path.isdir(os.path.join(project_path, ".git")):
                tasks.append((name, category, project_path))

    repos = []
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {
            executor.submit(_scan_single_repo_git, name, cat, path, limit_per_repo): name
            for name, cat, path in tasks
        }
        for future in as_completed(futures):
            try:
                result = future.result()
                if result:
                    repos.append(result)
            except Exception:
                pass

    repos.sort(
        key=lambda r: r["commits"][0]["date"] if r["commits"] else "",
        reverse=True,
    )

    _cache["git"] = repos
    _cache_time["git"] = now
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
