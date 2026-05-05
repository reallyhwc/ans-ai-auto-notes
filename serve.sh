#!/bin/bash
cd "$(dirname "$0")"
PORT=8765

PID=$(lsof -i :$PORT -sTCP:LISTEN -t 2>/dev/null)

if [ -n "$PID" ]; then
    echo "停止服务器 (PID $PID)..."
    kill $PID
    echo "已停止"
else
    echo "启动知识库服务器（Node.js + 实时刷新）..."
    node server.js &
    sleep 0.5
    open "http://localhost:$PORT/overview.html"
fi
