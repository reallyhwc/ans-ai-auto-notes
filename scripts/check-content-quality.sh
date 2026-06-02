#!/bin/bash
# check-content-quality.sh — 内容具象度检查
# 每个 kb/ 下非白名单的 md 文件至少含 mermaid / 代码块 / 表格 之一。
# 警告级，不阻断。
set -uo pipefail

# 在调用方 cwd 下扫描 kb/（arch-lint.sh 会先 cd 到项目根再调用本脚本）

# 白名单：目录路径前缀（允许全文字内容）
WHITELIST=(
  "kb/读书笔记"
)

is_whitelisted() {
  local file="$1"
  for prefix in "${WHITELIST[@]}"; do
    case "$file" in
      "$prefix"/*|"$prefix"*) return 0 ;;
    esac
  done
  return 1
}

WARN_COUNT=0
while IFS= read -r -d '' file; do
  if is_whitelisted "$file"; then
    continue
  fi
  HAS_MERMAID=$(grep -c '^```mermaid' "$file" 2>/dev/null)
  HAS_CODE=$(grep -c '^```' "$file" 2>/dev/null)
  HAS_TABLE=$(grep -cE '^\|.*\|' "$file" 2>/dev/null)
  : "${HAS_MERMAID:=0}"
  : "${HAS_CODE:=0}"
  : "${HAS_TABLE:=0}"
  if [ "$HAS_MERMAID" -eq 0 ] && [ "$HAS_CODE" -eq 0 ] && [ "$HAS_TABLE" -eq 0 ]; then
    echo "  ⚠️  $file — 缺少 mermaid / 代码块 / 表格 任一具象元素"
    WARN_COUNT=$((WARN_COUNT + 1))
  fi
done < <(find kb -name "*.md" -print0 2>/dev/null)

echo "  结果: $WARN_COUNT 个文件缺具象元素"
