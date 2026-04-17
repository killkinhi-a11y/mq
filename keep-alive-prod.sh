
#!/bin/bash
# Safe keep-alive: only restarts if port is truly free (no process holding it)
LOG='/tmp/mq-keepalive.log'
while true; do
  if ! ss -tlnp 2>/dev/null | grep -q ':3000 '; then
    echo "[$(date)] Port 3000 free, starting server..." >> $LOG
    cd /home/z/my-project/.next/standalone
    nohup node server.js >> /tmp/mq-server.log 2>&1 &
    sleep 8
    echo "[$(date)] Started, HTTP=$(curl -s -m 5 -o /dev/null -w '%{http_code}' http://localhost:3000/)" >> $LOG
  fi
  sleep 15
done
