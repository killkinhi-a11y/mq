#!/bin/bash
# MQ Player server keepalive & restart script
STANDALONE_DIR="/home/z/my-project/.next/standalone"
LOG="/tmp/mq-server.log"
PORT=3000

force_restart() {
  echo "[restart] Killing old processes..."
  pkill -9 -f "next-server" 2>/dev/null
  pkill -9 -f "node.*server.js" 2>/dev/null
  sleep 2

  # Ensure static files are up to date
  cp -r /home/z/my-project/public "$STANDALONE_DIR/public" 2>/dev/null
  cp -r /home/z/my-project/.next/static "$STANDALONE_DIR/.next/static" 2>/dev/null

  echo "[restart] Starting server..."
  # Use subshell to fully detach — bare & gets killed when parent shell exits
  ( cd "$STANDALONE_DIR" && PORT=$PORT nohup node server.js </dev/null > "$LOG" 2>&1 & )
  sleep 4

  local_code=$(curl -s --connect-timeout 5 -o /dev/null -w '%{http_code}' http://localhost:$PORT 2>/dev/null)
  if echo "$local_code" | grep -qE "^(200|307)$"; then
    echo "[restart] Server is up (port $PORT, code $local_code)"
  else
    echo "[restart] WARNING: server not responding after start (code $local_code)"
  fi
}

# If called with --force, always restart
if [ "${1}" = "--force" ]; then
  force_restart
  exit $?
fi

# Otherwise, only restart if server is down
if ! curl -s --connect-timeout 3 -o /dev/null -w '%{http_code}' http://localhost:$PORT 2>/dev/null | grep -qE "^(200|307)$"; then
  force_restart
fi
