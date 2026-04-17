#!/bin/bash
cd /home/z/my-project

# Ensure static files are in standalone
if [ ! -d ".next/standalone/.next/static" ] || [ "$(ls .next/standalone/.next/static/chunks/ 2>/dev/null | wc -l)" -lt 10 ]; then
  echo "Copying static files..."
  mkdir -p .next/standalone/.next
  cp -r .next/static .next/standalone/.next/static
  cp -r public .next/standalone/public 2>/dev/null
fi

echo "Starting MQ Player..."
exec HOSTNAME=:: NODE_ENV=production NODE_OPTIONS="--max-old-space-size=2048" PORT=3000 \
  node .next/standalone/server.js
