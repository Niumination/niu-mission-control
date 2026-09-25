#!/bin/bash
# Start script for Niumination Mission Control v4.0 Aether
# Used by LaunchAgent or manual start

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

# Load .env.local if exists
if [ -f ".env.local" ]; then
  echo "[start] Loading .env.local"
  set -a
  source .env.local
  set +a
elif [ -f "../.env.local" ]; then
  echo "[start] Loading ../.env.local"
  set -a
  source ../.env.local
  set +a
fi

# Ensure data dir exists
mkdir -p ../data/backups
mkdir -p ../logs 2>/dev/null || mkdir -p ./logs 2>/dev/null || true

# Check if built
if [ ! -f ".next/standalone/server.js" ] && [ ! -f "server.js" ]; then
  echo "[start] No build found, running npm run build..."
  npm run build
fi

# Prefer standalone server.js (Docker/next standalone), fallback to next start
if [ -f "server.js" ]; then
  echo "[start] Starting via node server.js (standalone)"
  exec node server.js
elif [ -f ".next/standalone/server.js" ]; then
  echo "[start] Starting via .next/standalone/server.js"
  exec node .next/standalone/server.js
else
  echo "[start] Starting via npm start"
  exec npm start
fi
