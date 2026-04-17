#!/bin/bash
cd /home/z/my-project
while true; do
  if ! ss -tlnp 2>/dev/null | grep -q ':3000.*LISTEN'; then
    echo "$(date) - Starting server..." >> /tmp/mq-watchdog.log
    pkill -f "agent-browser" 2>/dev/null
    pkill -f "chrome.*headless" 2>/dev/null
    sleep 1
    NODE_ENV=production HOSTNAME=:: NODE_OPTIONS="--max-old-space-size=384" PORT=3000 \
      node .next/standalone/server.js >> /tmp/mq-watchdog.log 2>&1 &
  fi
  sleep 10
done
