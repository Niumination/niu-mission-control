#!/bin/bash
cd "$(dirname "$0")/frontend"
python3 ../db_manager.py > /dev/null 2>&1
exec npx next start --port 5200 --hostname 0.0.0.0
