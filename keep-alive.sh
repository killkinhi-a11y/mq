#!/bin/bash
while true; do
    cd /home/z/my-project/.next/standalone
    PORT=3000 node server.js 2>&1
    echo "Restarting in 1s..."
    sleep 1
done
