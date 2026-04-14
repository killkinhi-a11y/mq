#!/bin/bash
# MQ Player server keepalive script
if curl -s -o /dev/null -w '%{http_code}' http://localhost:3000 2>/dev/null | grep -q "200"; then
  exit 0
fi
# Kill any leftover node server processes on port 3000
fuser -k 3000/tcp 2>/dev/null
sleep 1
cd /home/z/my-project/.next/standalone
PORT=3000 nohup node server.js > /tmp/mq-server.log 2>&1 &
disown
sleep 4
# System Caddy on port 81 is managed externally — no need to start it
