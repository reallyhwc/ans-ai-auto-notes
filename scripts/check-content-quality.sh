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
    # 必须是目录前缀（带 /），不允许 kb/读书笔记abc.md 之类的误匹配
    case "$file" in
      "$prefix"/*) return 0 ;;
    esac
  done
  return 1
}

WARN_COUNT=0
# 性能：此前每个文件 3 次 grep -c（mermaid/代码块/表格），改为 1 次 grep -q 合并判断，
# 三条件任一命中即视为"有具象元素"。行为不变。
while IFS= read -r -d '' file; do
  if is_whitelisted "$file"; then
    continue
  fi
  if ! grep -qE '^```mermaid|^```|^\|.*\|' "$file" 2>/dev/null; then
    echo "  ⚠️  $file — 缺少 mermaid / 代码块 / 表格 任一具象元素"
    WARN_COUNT=$((WARN_COUNT + 1))
  fi
done < <(find kb -name "*.md" -print0 2>/dev/null)

echo "  结果: $WARN_COUNT 个文件缺具象元素"
