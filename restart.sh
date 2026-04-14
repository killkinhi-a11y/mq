#!/bin/bash
# MQ Player server keepalive script
if curl -s --connect-timeout 3 -o /dev/null -w '%{http_code}' http://localhost:3000 2>/dev/null | grep -q "200"; then
  exit 0
fi
# Kill stale processes
pkill -f "node.*server.js" 2>/dev/null
sleep 1
# Start with auto-restart loop
nohup /tmp/mq-keepalive.sh > /dev/null 2>&1 &
disown
sleep 4
