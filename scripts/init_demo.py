#!/usr/bin/env python3
"""Init dummy artifacts for demo (separate from production server logic)."""
import os
from datetime import datetime

def main():
    os.makedirs("/tmp/hermes_research", exist_ok=True)
    os.makedirs("/tmp/hermes_qa", exist_ok=True)
    spec_path = "/tmp/hermes_research/active_spec.md"
    if not os.path.exists(spec_path):
        with open(spec_path, "w") as f:
            f.write(f"""# Hermes Swarm - Project Blueprint\n- **Generated**: {datetime.now()}\n""")
    print("Dummy artifacts initialized.")

if __name__ == "__main__":
    main()
