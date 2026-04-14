#!/bin/sh
cd /home/z/my-project
while true; do
  npx next dev -p 3000
  echo "Server crashed, restarting in 2s..."
  sleep 2
done
