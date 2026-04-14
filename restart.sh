#!/bin/bash
# MQ Player server keepalive script
if curl -s -o /dev/null -w '%{http_code}' http://localhost:3000 2>/dev/null | grep -q "200"; then
  exit 0
fi
cd /home/z/my-project/.next/standalone
PORT=3000 nohup node server.js > /tmp/mq-server.log 2>&1 &
disown
sleep 3
# Caddy on port 81
if ! pgrep -f "caddy.*:81" > /dev/null 2>&1; then
  nohup /usr/bin/caddy reverse-proxy --from :81 --to localhost:3000 > /tmp/caddy.log 2>&1 &
  disown
  sleep 2
fi
