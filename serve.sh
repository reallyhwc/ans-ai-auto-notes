#!/bin/bash
set -uo pipefail
cd "$(dirname "$0")"
PORT=8765

PID=$(lsof -i :$PORT -sTCP:LISTEN -t 2>/dev/null || true)

if [ -n "$PID" ]; then
    echo "停止服务器 (PID $PID)..."
    kill "$PID" 2>/dev/null || true
    # 最多等 1s 让端口释放
    for _ in 1 2 3 4 5; do
      kill -0 "$PID" 2>/dev/null || break
      sleep 0.2
    done
    echo "已停止"
else
    echo "启动知识库服务器（Node.js + 实时刷新）..."
    echo "构建 manifest.json + INDEX.md..."
    node scripts/build-index.js
    node server.js &
    sleep 0.5
    open "http://localhost:$PORT/overview.html"
fi
