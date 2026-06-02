#!/bin/bash
# verify-claim.sh — PostToolUse hook：验证 Write/Edit 写入的 kb/ 或 memory/ 文件确实存在
# 输出: append 到 .claude/claim-ledger.log
# 入参（环境变量）: $CLAUDE_TOOL_NAME, $CLAUDE_TOOL_INPUT (JSON)
set -uo pipefail
cd "$(dirname "$0")/.."

LEDGER=".claude/claim-ledger.log"
mkdir -p "$(dirname "$LEDGER")"

TOOL="${CLAUDE_TOOL_NAME:-unknown}"
INPUT="${CLAUDE_TOOL_INPUT:-}"
[ -z "$INPUT" ] && INPUT='{}'

# 用 python3 安全提取 file_path（避免 jq 依赖）
FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    p = d.get('file_path') or d.get('notebook_path') or ''
    print(p)
except Exception:
    print('')
" 2>/dev/null)

# 仅处理 kb/ 或 memory/ 路径
case "$FILE_PATH" in
  */kb/*|*/memory/*|kb/*|memory/*)
    ;;
  *)
    exit 0
    ;;
esac

TS=$(date "+%Y-%m-%d %H:%M:%S")
if [ -f "$FILE_PATH" ]; then
  echo "$TS | $TOOL | $FILE_PATH | exists" >> "$LEDGER"
else
  echo "$TS | $TOOL | $FILE_PATH | MISSING" >> "$LEDGER"
  echo "⚠️  verify-claim: 声称写入但文件不存在: $FILE_PATH" >&2
fi
