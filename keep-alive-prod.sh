#!/bin/bash
# MQ Player - Keep Alive Script
# Checks server health every 30s and restarts if down

LOG="/tmp/mq-keepalive.log"

while true; do
    # Check if port 3000 is responding
    HTTP_CODE=$(curl -s -m 5 -w "%{http_code}" -o /dev/null http://localhost:3000/ 2>/dev/null)
    PORT_CHECK=$(ss -tlnp 2>/dev/null | grep ":3000 " || echo "")

    if [ "$HTTP_CODE" = "000" ] || [ -z "$PORT_CHECK" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Server DOWN (HTTP=$HTTP_CODE, PORT=${PORT_CHECK:-empty}). Restarting..." >> "$LOG"

        # Kill any remaining processes
        fuser -k 3000/tcp 2>/dev/null
        pkill -f "next-server" 2>/dev/null
        pkill -f "node.*server.js" 2>/dev/null
        pkill -f "node.*standalone" 2>/dev/null
        pkill -f "npm exec next" 2>/dev/null
        sleep 2

        # Copy static assets for standalone server
        cp -r /home/z/my-project/.next/static /home/z/my-project/.next/standalone/.next/static 2>/dev/null
        cp -r /home/z/my-project/public /home/z/my-project/.next/standalone/public 2>/dev/null
        ln -sf /home/z/my-project/uploads /home/z/my-project/.next/standalone/uploads 2>/dev/null

        # Start standalone server
        cd /home/z/my-project/.next/standalone
        NODE_ENV=production PORT=3000 nohup node server.js >> /tmp/mq-server.log 2>&1 &
        disown

        # Wait and verify
        sleep 8
        NEW_CODE=$(curl -s -m 5 -w "%{http_code}" -o /dev/null http://localhost:3000/ 2>/dev/null)
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restart result: HTTP=$NEW_CODE" >> "$LOG"
    fi

    sleep 30
done
