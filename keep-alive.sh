#!/bin/bash
cd /home/z/my-project
while true; do
    if ss -tlnp 2>/dev/null | grep -q ":3000 "; then
        sleep 3
        continue
    fi
    echo "$(date): Starting server..."
    HOSTNAME=:: NODE_OPTIONS="--max-old-space-size=2048" PORT=3000 \
        node .next/standalone/server.js >> /tmp/server.log 2>&1
    echo "$(date): Exited code=$?"
    sleep 2
done
