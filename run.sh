#!/bin/bash
cd /home/z/my-project
while true; do
    echo "[$(date)] Starting server..."
    npx next dev --port 3000 2>&1
    echo "[$(date)] Server exited, restarting in 3s..."
    sleep 3
done
