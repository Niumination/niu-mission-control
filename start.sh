#!/bin/bash
# Start Mission Control Next.js server
# This script is used by the LaunchAgent

cd "$(dirname "$0")"

# Ensure database is initialized
python3 db_manager.py

# Start Next.js in production mode
exec npx next start --port 5200 --hostname 0.0.0.0
