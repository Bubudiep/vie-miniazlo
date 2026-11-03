#!/bin/bash
# Script to start PocketBase server

echo "Starting PocketBase server..."

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a
  . "$SCRIPT_DIR/.env"
  set +a
fi

cd "$SCRIPT_DIR/pocketbase"

# Kill existing PocketBase process if running
pkill -f pocketbase || true
sleep 2

# Run migrations first
echo "Running migrations..."
./pocketbase migrate

# Start PocketBase
echo "Starting PocketBase on http://127.0.0.1:8390"
echo "Admin UI: http://127.0.0.1:8390/_/"
echo "Press Ctrl+C to stop"
./pocketbase serve --http="127.0.0.1:8390"
