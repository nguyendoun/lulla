#!/bin/bash
# Mở Lulla: bật server nếu chưa chạy, rồi mở Chrome
cd "$(dirname "$0")"
if ! curl -s -o /dev/null http://localhost:3000; then
  MUSIC_DIR="$PWD/music" nohup npm run dev > /tmp/lulla.log 2>&1 &
  for i in $(seq 1 60); do curl -s -o /dev/null http://localhost:3000 && break; sleep 1; done
fi
google-chrome --app=http://localhost:3000 >/dev/null 2>&1 &
