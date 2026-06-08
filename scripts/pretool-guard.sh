#!/bin/bash
# arch-lint-ignore-unref: Hook script attached via PreToolUse in .claude/settings.local.json
# pretool-guard.sh — PreToolUse hook：拦截对勿手改文件的直接编辑
#
# 被拦截文件（构建产物或自动生成）：
#   - INDEX.md（由 build-index.js 生成）
#   - manifest.json（由 build-index.js 生成）
#   - overview.html（手改会被覆盖/破坏）
#
# 退出码：
#   0 = 放行
#   2 = 拦截（Claude Code 会阻断该工具调用）
set -uo pipefail

STDIN_JSON=""
if [ ! -t 0 ]; then
  STDIN_JSON=$(cat)
fi

[ -z "$STDIN_JSON" ] && exit 0

FILE_PATH=$(echo "$STDIN_JSON" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    ti = d.get('tool_input', {}) or {}
    print(ti.get('file_path') or ti.get('notebook_path') or '')
except Exception:
    print('')
" 2>/dev/null)

[ -z "$FILE_PATH" ] && exit 0

# 提取文件名（去掉目录前缀）
BASENAME=$(basename "$FILE_PATH")

case "$BASENAME" in
  INDEX.md|manifest.json|overview.html)
    echo "🚫 pretool-guard: $BASENAME 是构建产物，禁止直接编辑。请通过 build-index.js 或修改源文件。" >&2
    exit 2
    ;;
esac

exit 0
