#!/bin/bash
# MQ Player - Keep Alive Script
# Checks server health every 10s and restarts if down

LOG="/tmp/mq-keepalive.log"

while true; do
    # Check if port 3000 is responding
    HTTP_CODE=$(curl -s -m 5 -w "%{http_code}" -o /dev/null http://localhost:3000/ 2>/dev/null)
    PORT_CHECK=$(ss -tlnp 2>/dev/null | grep ":3000 " || echo "")
    
    if [ "$HTTP_CODE" = "000" ] || [ -z "$PORT_CHECK" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Server DOWN (HTTP=$HTTP_CODE, PORT=${PORT_CHECK:-empty}). Restarting..." >> "$LOG"
        
        # Kill any remaining processes
        pkill -f "next" 2>/dev/null
        sleep 2
        
        # Kill any zombie processes holding port 3000
        fuser -k 3000/tcp 2>/dev/null
        sleep 1
        
        # Start server (standalone mode)
        cd /home/z/my-project
        nohup node .next/standalone/server.js -p 3000 >> /tmp/mq-server.log 2>&1 &
        disown
        
        # Wait and verify
        sleep 8
        NEW_CODE=$(curl -s -m 5 -w "%{http_code}" -o /dev/null http://localhost:3000/ 2>/dev/null)
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restart result: HTTP=$NEW_CODE" >> "$LOG"
    fi
    
    sleep 10
done
