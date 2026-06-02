#!/bin/bash
# arch-lint-ignore-unref: Hook script attached via PostToolUse in .claude/settings.local.json (managed by bootstrap.sh)
# verify-claim.sh — PostToolUse hook：验证 Write/Edit 写入的 kb/ 或 memory/ 文件确实存在
# 输出: append 到 .claude/claim-ledger.log
#
# 输入协议（双轨，stdin 优先）:
#   1. 真实 Claude Code: stdin 传入 JSON
#      { "tool_name": "Edit", "tool_input": { "file_path": "..." }, ... }
#   2. 手动测试: env var CLAUDE_TOOL_NAME + CLAUDE_TOOL_INPUT (JSON)
set -uo pipefail
cd "$(dirname "$0")/.."

LEDGER=".claude/claim-ledger.log"
mkdir -p "$(dirname "$LEDGER")"

# 读 stdin（如果有）；若 stdin 是 tty 则跳过（手动调用场景）
STDIN_JSON=""
if [ ! -t 0 ]; then
  STDIN_JSON=$(cat)
fi

if [ -n "$STDIN_JSON" ]; then
  # 真实 hook 路径：从 stdin JSON 提取 tool_name + tool_input.file_path
  PARSED=$(echo "$STDIN_JSON" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    tool = d.get('tool_name', '') or ''
    ti = d.get('tool_input', {}) or {}
    fp = ti.get('file_path') or ti.get('notebook_path') or ''
    print(tool)
    print(fp)
except Exception:
    print('')
    print('')
" 2>/dev/null)
  TOOL=$(printf '%s\n' "$PARSED" | sed -n '1p')
  FILE_PATH=$(printf '%s\n' "$PARSED" | sed -n '2p')
else
  # Fallback：从 env var 读（手动测试 / 兼容旧脚本）
  TOOL="${CLAUDE_TOOL_NAME:-unknown}"
  INPUT="${CLAUDE_TOOL_INPUT:-}"
  [ -z "$INPUT" ] && INPUT='{}'
  FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    p = d.get('file_path') or d.get('notebook_path') or ''
    print(p)
except Exception:
    print('')
" 2>/dev/null)
fi

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
