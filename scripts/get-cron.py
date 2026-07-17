#!/usr/bin/env python3
"""Cron job health widget — outputs JSON."""
import json
import os
import re
import subprocess

HOME = "/Users/zaryu"

def parse_cron_list(text):
    """Parse hermes cron list output into structured jobs."""
    jobs = []
    # Split by job ID pattern (hex string followed by [active/paused])
    blocks = re.split(r'\n\n(?=\s{2}[0-9a-f]{12})', text.strip())
    for block in blocks:
        block = block.strip()
        if not block:
            continue

        job = {}
        # ID and status — with optional leading spaces
        m = re.match(r'\s*([0-9a-f]+)\s+\[(\w+)\]', block)
        if m:
            job['id'] = m.group(1)
            job['status'] = m.group(2)

        # Fields
        for line in block.split('\n'):
            line = line.strip()
            if ':' in line:
                key, val = line.split(':', 1)
                key = key.strip().lower().replace(' ', '_')
                val = val.strip()

                if key == 'name':
                    job['name'] = val
                elif key == 'schedule':
                    job['schedule'] = val
                elif key == 'repeat':
                    job['repeat'] = val
                elif key == 'next_run':
                    job['next_run'] = val
                elif key == 'deliver':
                    job['deliver'] = val
                elif key == 'script':
                    job['script'] = val
                elif key == 'mode':
                    job['mode'] = val
                elif key == 'skills':
                    job['skills'] = val
                elif key == 'last_run':
                    # Last run line has timestamp + status
                    parts = val.rsplit(' ', 1)
                    if len(parts) == 2:
                        job['last_run'] = parts[0]
                        job['last_status'] = parts[1]
                    else:
                        job['last_run'] = val

        if job:
            jobs.append(job)
    return jobs

def main():
    jobs = []
    cli_raw = ""

    # Try hermes cron list
    try:
        r = subprocess.run(
            ["hermes", "cron", "list"],
            capture_output=True, text=True, timeout=15,
            env={**os.environ, "HOME": HOME}
        )
        if r.returncode == 0:
            cli_raw = r.stdout
            jobs = parse_cron_list(r.stdout)
        else:
            cli_raw = f"Error: {r.stderr[:200]}"
    except Exception as e:
        cli_raw = f"hermes CLI not available: {e}"

    # Count statuses
    ok_jobs = sum(1 for j in jobs if j.get('last_status') == 'ok')
    failed_jobs = sum(1 for j in jobs if j.get('last_status') not in ('ok', '', None))
    active_jobs = sum(1 for j in jobs if j.get('status') == 'active')
    paused_jobs = sum(1 for j in jobs if j.get('status') == 'paused')

    print(json.dumps({
        "cron_jobs": jobs,
        "cronjob_cli": cli_raw[:300],
        "cron_count": len(jobs),
        "active": active_jobs,
        "paused": paused_jobs,
        "ok_count": ok_jobs,
        "failed_count": failed_jobs,
        "all_healthy": failed_jobs == 0 and len(jobs) > 0,
    }))

if __name__ == "__main__":
    main()
