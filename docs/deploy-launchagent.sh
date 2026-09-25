#!/bin/bash
# deploy-launchagent.sh — Install LaunchAgent untuk MC v3.0.0
# Usage: bash deploy-launchagent.sh

set -e

PLIST_SRC="docs/com.niumination.missioncontrol.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.niumination.missioncontrol.plist"
LOGS_DIR="$HOME/Desktop/Niumination/logs"

echo "=== Deploying LaunchAgent for Mission Control v3.0.0 ==="
echo

# Create logs directory
mkdir -p "$LOGS_DIR"

# Copy plist
cp "$PLIST_SRC" "$PLIST_DST"
echo "✓ Plist copied to $PLIST_DST"

# Unload if already loaded
if launchctl list com.niumination.missioncontrol >/dev/null 2>&1; then
    echo "✓ Unloading existing service..."
    launchctl unload "$PLIST_DST" 2>/dev/null || true
fi

# Load service
echo "✓ Loading service..."
launchctl load "$PLIST_DST"

# Wait for startup
sleep 2

# Check status
if launchctl list com.niumination.missioncontrol | grep -q "com.niumination.missioncontrol"; then
    echo "✓ Service loaded successfully"
    echo
    echo "=== Status ==="
    launchctl list com.niumination.missioncontrol | head -5
else
    echo "✗ Service failed to load"
    exit 1
fi

echo
echo "=== Access MC ==="
echo "http://localhost:5200"
echo
echo "Logs:"
echo "  STDOUT: $LOGS_DIR/mission-control.stdout.log"
echo "  STDERR: $LOGS_DIR/mission-control.stderr.log"
echo
echo "Commands:"
echo "  Stop:  launchctl stop com.niumination.missioncontrol"
echo "  Start: launchctl start com.niumination.missioncontrol"
echo "  Remove: launchctl unload $PLIST_DST"
