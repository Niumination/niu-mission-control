#!/usr/bin/env python3
"""Project git health widget — outputs JSON. Uses git status -b for upstream info."""
import json
import subprocess
import os
from pathlib import Path

PROJECTS_DIRS = [
    ("Production", "/Users/zaryu/Desktop/Niumination/Production"),
    ("Projects", "/Users/zaryu/Desktop/Niumination/projects"),
]

def git_status(repo_path):
    """Get git status summary for a repo using git status -b (branch info included)."""
    try:
        # Check if git repo
        r = subprocess.run(
            ["git", "rev-parse", "--is-inside-work-tree"],
            capture_output=True, text=True, timeout=3, cwd=repo_path
        )
        if r.returncode != 0:
            return None

        # Branch + upstream info via status -b
        r2 = subprocess.run(
            ["git", "status", "--short", "-b"],
            capture_output=True, text=True, timeout=5, cwd=repo_path
        )
        output = r2.stdout
        lines = output.split('\n')
        branch_line = lines[0] if lines else ""

        # Parse branch line: "## main...origin/main [ahead 1, behind 2]"
        branch = branch_line.replace("## ", "").split("...")[0] if "##" in branch_line else "detached"

        ahead = 0
        behind = 0
        if "ahead" in branch_line:
            import re
            m = re.search(r'ahead (\d+)', branch_line)
            if m: ahead = int(m.group(1))
            m = re.search(r'behind (\d+)', branch_line)
            if m: behind = int(m.group(1))

        # Changed files
        change_lines = [l.strip() for l in lines[1:] if l.strip()]
        change_count = len(change_lines)

        return {
            "branch": branch,
            "changes": change_count,
            "changed_files": change_lines[:10] if change_lines else [],
            "ahead": str(ahead),
            "behind": str(behind),
            "dirty": change_count > 0,
        }
    except subprocess.TimeoutExpired:
        return {"error": "timeout", "branch": "?", "dirty": False}
    except Exception as e:
        return {"error": str(e), "branch": "?", "dirty": False}

def main():
    results = {}
    for category, base_dir in PROJECTS_DIRS:
        results[category] = {}
        base = Path(base_dir)
        if not base.exists():
            continue
        for item in sorted(base.iterdir()):
            if item.is_dir() and not item.name.startswith('.'):
                git = git_status(str(item))
                if git:
                    results[category][item.name] = git

    # Also check key repos
    key_repos = [
        "/Users/zaryu/Desktop/Niumination",
        "/Users/zaryu/Desktop/Niumination/brain",
    ]
    for rp in key_repos:
        name = os.path.basename(rp)
        git = git_status(rp)
        if git:
            results["Root"] = results.get("Root", {})
            results["Root"][name] = git

    # Summary
    total_repos = 0
    dirty_repos = 0
    for cat in results.values():
        for name, info in cat.items():
            total_repos += 1
            if info.get("dirty"):
                dirty_repos += 1

    print(json.dumps({
        "total_repos": total_repos,
        "dirty_repos": dirty_repos,
        "clean_repos": total_repos - dirty_repos,
        "categories": results,
    }))

if __name__ == "__main__":
    main()
