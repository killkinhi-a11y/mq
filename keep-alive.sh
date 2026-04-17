#!/bin/bash
cd /home/z/my-project
export HOSTNAME=::
export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=2048"
export PORT=3000

while true; do
    if ss -tlnp 2>/dev/null | grep -q ":3000 "; then
        sleep 3
        continue
    fi
    echo "$(date): Starting MQ Player server..." >> /tmp/mq-keepalive.log
    node .next/standalone/server.js >> /tmp/mq-server.log 2>&1
    EXIT=$?
    echo "$(date): Server exited code=$EXIT, mem=$(free -m | awk '/Mem:/{print $3}')" >> /tmp/mq-keepalive.log
    sleep 2
done
