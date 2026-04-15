#!/bin/bash
echo "Stopping nanoclaw..."
systemctl --user stop nanoclaw
# Force-kill any lingering containers
podman ps --filter name=nanoclaw --format '{{.Names}}' | xargs -r podman stop 2>/dev/null
# Wait for clean stop
sleep 2
echo "Starting nanoclaw..."
systemctl --user start nanoclaw
systemctl --user status nanoclaw --no-pager
