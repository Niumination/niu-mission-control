#!/bin/bash
# Niu-MissionControl Aggregator — kumpulkan data dari semua widget
# Output: JSON gabungan, bisa di-feed ke dashboard

MC_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPTS_DIR="$MC_DIR/scripts"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "{"
echo "  \"timestamp\": \"$TIMESTAMP\","
echo "  ,\"agents\":"
python3 "$SCRIPTS_DIR/get-agents.py" 2>/dev/null || echo '{"status":"error"}'
echo "  ,\"cron\":"
python3 "$SCRIPTS_DIR/get-cron.py" 2>/dev/null || echo '{"status":"error"}'
echo "  ,\"projects\":"
python3 "$SCRIPTS_DIR/get-git.py" 2>/dev/null || echo '{"status":"error"}'
echo "  ,\"gateway\":"
python3 "$SCRIPTS_DIR/get-gateway.py" 2>/dev/null || echo '{"status":"error'}"

# Kanban quick stats (from running server)
KANBAN_DATA=$(curl -s http://localhost:5199/api/stats 2>/dev/null || echo '{"error":"offline"}')
echo "  ,\"kanban\": $KANBAN_DATA"

echo "}"
