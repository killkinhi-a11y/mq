#!/bin/bash
while true; do
  cd /home/z/my-project/.next/standalone
  NODE_OPTIONS="--max-old-space-size=4096" node server.js -H 0.0.0.0 -p 3000 >> /tmp/mq-server.log 2>&1
  echo "[$(date)] Server died, restarting in 2s..." >> /tmp/mq-server.log
  sleep 2
done
