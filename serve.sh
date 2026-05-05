#!/bin/bash
cd "$(dirname "$0")"
PORT=8765

if lsof -i :$PORT -sTCP:LISTEN > /dev/null 2>&1; then
    echo "已在运行 → http://localhost:$PORT"
else
    echo "启动知识库服务器..."
    python3 -m http.server $PORT --directory . &
    sleep 0.5
fi

open "http://localhost:$PORT"
