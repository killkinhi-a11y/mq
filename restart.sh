#!/bin/bash
# MQ Player server keepalive script
if curl -s --connect-timeout 3 -o /dev/null -w '%{http_code}' http://localhost:3000 2>/dev/null | grep -q "200"; then
  exit 0
fi
pkill -f "bun server" 2>/dev/null
pkill -f "node server" 2>/dev/null
sleep 1
cd /home/z/my-project/.next/standalone
PORT=3000 nohup bun server.js > /tmp/mq-server.log 2>&1 &
disown
sleep 4
