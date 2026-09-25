#!/bin/sh
ROOT_EXAMPLE="../.env.example"
APEX_EXAMPLE=".env.example"
[ ! -f "$ROOT_EXAMPLE" ] && echo "❌ $ROOT_EXAMPLE not found" && exit 1
cp "$ROOT_EXAMPLE" "$APEX_EXAMPLE"
echo "✅ Synced $ROOT_EXAMPLE → $APEX_EXAMPLE"
