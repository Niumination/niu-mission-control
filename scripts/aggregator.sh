#!/bin/bash
# Niu-MissionControl Aggregator — collect all widget data
# Output: JSON merged from all scripts

MC_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPTS_DIR="$MC_DIR/scripts"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Collect all data
AGENTS=$(python3 "$SCRIPTS_DIR/get-agents.py" 2>/dev/null || echo '{"status":"error"}')
CRON=$(python3 "$SCRIPTS_DIR/get-cron.py" 2>/dev/null || echo '{"status":"error"}')
PROJECTS=$(python3 "$SCRIPTS_DIR/get-git.py" 2>/dev/null || echo '{"status":"error"}')
GATEWAY=$(python3 "$SCRIPTS_DIR/get-gateway.py" 2>/dev/null || echo '{"status":"error"}')
SYSTEM=$(python3 "$SCRIPTS_DIR/get-system.py" 2>/dev/null || echo '{"status":"error"}')

# Kanban quick stats
KANBAN=$(curl -s http://localhost:5199/api/stats 2>/dev/null || echo '{"error":"offline"}')

# Build JSON using jq if available, otherwise Python
if command -v jq &>/dev/null; then
  jq -n \
    --arg ts "$TIMESTAMP" \
    --argjson agents "$AGENTS" \
    --argjson cron "$CRON" \
    --argjson projects "$PROJECTS" \
    --argjson gateway "$GATEWAY" \
    --argjson system "$SYSTEM" \
    --argjson kanban "$KANBAN" \
    '{timestamp: $ts, agents: $agents, cron: $cron, projects: $projects, gateway: $gateway, system: $system, kanban: $kanban}'
else
  python3 -c "
import json
ts = '$TIMESTAMP'
data = {
  'timestamp': ts,
  'agents': json.loads('''$AGENTS'''),
  'cron': json.loads('''$CRON'''),
  'projects': json.loads('''$PROJECTS'''),
  'gateway': json.loads('''$GATEWAY'''),
  'system': json.loads('''$SYSTEM'''),
  'kanban': json.loads('''$KANBAN'''),
}
print(json.dumps(data, indent=2))
"
fi
