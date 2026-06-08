#!/bin/bash
# hook-logger.sh — hook 执行包装器，记录每次执行到 JSONL
#
# 用法: bash scripts/hook-logger.sh <hook-name> <actual-command...>
# 输出: 追加一行 JSON 到 logs/hook-runs.jsonl
#
# 字段: { time, hook, command, exit_code, duration_ms }
# 设计: 透明包装，不改变原命令的 exit code 和 stdout/stderr

HOOK_NAME="${1:?Usage: hook-logger.sh <hook-name> <command...>}"
shift
CMD="$*"

LOG_FILE="${HOOK_LOG_FILE:-$(cd "$(dirname "$0")/.." && pwd)/logs/hook-runs.jsonl}"
mkdir -p "$(dirname "$LOG_FILE")"

START_MS=$(python3 -c "import time; print(int(time.time()*1000))" 2>/dev/null || echo 0)

set +e
( eval "$CMD" )
EXIT_CODE=$?
set -e

END_MS=$(python3 -c "import time; print(int(time.time()*1000))" 2>/dev/null || echo 0)
DURATION_MS=$((END_MS - START_MS))
TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# 用 python3 写 JSON（避免 shell 转义问题）
python3 -c "
import json, sys
entry = {
    'time': '$TIME',
    'hook': '$HOOK_NAME',
    'command': '''$CMD''',
    'exit_code': $EXIT_CODE,
    'duration_ms': $DURATION_MS
}
with open('$LOG_FILE', 'a') as f:
    f.write(json.dumps(entry) + '\n')
" 2>/dev/null || true

exit $EXIT_CODE
