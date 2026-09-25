#!/bin/bash
# Start script for Niumination Mission Control v4.1 Aether Sync
# Next.js 16.3.5 + PWA + i18n + DOX v4.0
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

# Load .env.local if exists
if [ -f ".env.local" ]; then
  echo "[start] Loading .env.local"
  set -a; source .env.local; set +a
elif [ -f "../.env.local" ]; then
  echo "[start] Loading ../.env.local"
  set -a; source ../.env.local; set +a
fi

# Ensure dirs
mkdir -p ../data/backups
mkdir -p ../logs 2>/dev/null || mkdir -p ./logs 2>/dev/null || true
mkdir -p public 2>/dev/null || true

# Check build
if [ ! -f ".next/standalone/server.js" ] && [ ! -f "server.js" ]; then
  echo "[start] No build found, running npm run build..."
  npm run build
fi

# Prefer standalone server.js (Next 16)
if [ -f ".next/standalone/server.js" ]; then
  echo "[start] Starting standalone server.js (Next 16.3.5)"
  exec node .next/standalone/server.js
elif [ -f "server.js" ]; then
  echo "[start] Starting server.js"
  exec node server.js
else
  echo "[start] Starting via npm start"
  exec npm start
fi
