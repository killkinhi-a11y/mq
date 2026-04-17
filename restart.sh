#!/bin/bash
# MQ Player server keepalive & restart script
PROJECT_DIR="/home/z/my-project"
STANDALONE_DIR="$PROJECT_DIR/.next/standalone"
LOG="$PROJECT_DIR/server.log"
PORT=3000

force_restart() {
  echo "[restart] Killing old processes..."
  pkill -9 -f "next-server" 2>/dev/null
  pkill -9 -f "node.*server.js" 2>/dev/null
  sleep 2

  # Ensure static files are up to date
  cp -r "$PROJECT_DIR/public" "$STANDALONE_DIR/public" 2>/dev/null
  cp -r "$PROJECT_DIR/.next/static" "$STANDALONE_DIR/.next/static" 2>/dev/null

  # Ensure uploads directory exists
  mkdir -p "$STANDALONE_DIR/public/uploads" 2>/dev/null
  mkdir -p "$PROJECT_DIR/public/uploads" 2>/dev/null

  echo "[restart] Starting server..."
  # Use subshell to fully detach from this shell
  ( cd "$STANDALONE_DIR" && PORT=$PORT nohup node server.js </dev/null > "$LOG" 2>&1 & )
  sleep 5

  # Check /play (main app route) instead of / (which redirects)
  local_code=$(curl -s --connect-timeout 5 -o /dev/null -w '%{http_code}' http://localhost:$PORT/play 2>/dev/null)
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

# Otherwise, only restart if server is down (check /play for reliable 200)
if ! curl -s --connect-timeout 3 -o /dev/null -w '%{http_code}' http://localhost:$PORT/play 2>/dev/null | grep -qE "^200$"; then
  force_restart
fi
