#!/bin/bash
if curl -s -o /dev/null -w '%{http_code}' http://localhost:3000 2>/dev/null | grep -q "200"; then
  exit 0
fi
cd /home/z/my-project/.next/standalone
PORT=3000 node server.js &
sleep 2
# Caddy
if ! curl -s -o /dev/null -w '%{http_code}' http://localhost:8080 2>/dev/null | grep -q "200"; then
  caddy reverse-proxy --from :8080 --to localhost:3000 &
fi
