#!/bin/bash
# Agent Runner — keeps a persistent terminal pane alive for an AI agent
# Spawned by: herdr agent start <name> -- ./scripts/agent-runner.sh <name>
NAME="${1:-agent}"
echo "🤖 Agent [$NAME] initialized — awaiting commands via herdr agent send"
echo "CWD: $(pwd)"
echo "---"
echo ""
# Stay alive, read from stdin
while true; do
  if read -t 1 line 2>/dev/null; then
    echo "[$(date '+%H:%M:%S')] Received: $line"
    # If it's a command, execute it
    if [[ "$line" == "!"* ]]; then
      cmd="${line:1}"
      echo "→ Executing: $cmd"
      eval "$cmd" 2>&1
      echo "→ Exit: $?"
    else
      echo "→ (note received)"
    fi
  fi
done
