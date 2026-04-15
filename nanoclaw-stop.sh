#!/bin/bash
echo "Stopping containers..."
podman ps --filter name=nanoclaw --format '{{.Names}}' | xargs -r podman stop 2>/dev/null
echo "Stopping nanoclaw service..."
systemctl --user stop nanoclaw
echo "Done."
