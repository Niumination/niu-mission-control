#!/usr/bin/env python3
"""Cron job health widget — outputs JSON."""
import json
import sqlite3
import os
import subprocess

CRON_DB = os.path.expanduser("~/.hermes/state.db")
HOME = "/Users/zaryu"

def main():
    # Try state.db
    cron_data = []
    try:
        db = sqlite3.connect(CRON_DB)
        cursor = db.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [r[0] for r in cursor.fetchall()]
        
        # Try multiple possible table names
        for tbl in tables:
            if 'cron' in tbl.lower() or 'schedule' in tbl.lower() or 'job' in tbl.lower():
                cursor2 = db.execute(f"SELECT * FROM {tbl} LIMIT 20")
                cols = [d[0] for d in cursor2.description]
                rows = cursor2.fetchall()
                for r in rows:
                    row_dict = dict(zip(cols, r))
                    cron_data.append(row_dict)
        db.close()
    except Exception as e:
        cron_data = [{"error": f"state.db: {e}"}]

    # Also check via cronjob CLI
    cli_out = ""
    try:
        r = subprocess.run(["cronjob", "action=list"], capture_output=True, text=True, timeout=15,
                          env={**os.environ, "HOME": HOME})
        cli_out = r.stdout[:500]
    except Exception as e:
        cli_out = f"cronjob CLI: {e}"

    print(json.dumps({
        "state_db_cron": cron_data,
        "cronjob_cli": cli_out,
        "cron_count": len(cron_data),
    }))

if __name__ == "__main__":
    main()
