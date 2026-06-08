#!/bin/bash
# content-quality-fast.sh — 轻量级 kb/ 内容质量检查（Stop hook 用）
# 不 spawn agent，纯 shell 检查三项：交叉链接、具象元素、元信息头日期
#
# 模式：
#   默认: 只检查本 session 修改过的 kb/ 文件（git diff --name-only HEAD~）
#   CQF_CHECK_ALL=1: 检查所有 kb/ 文件
set -uo pipefail
cd "$(dirname "$0")/.."

WARN_COUNT=0

if [ "${CQF_CHECK_ALL:-}" = "1" ]; then
  FILES=$(find kb -name "*.md" -type f 2>/dev/null)
else
  FILES=$(git diff --name-only HEAD~1 2>/dev/null | grep '^kb/.*\.md$' || true)
  [ -z "$FILES" ] && FILES=$(git diff --cached --name-only 2>/dev/null | grep '^kb/.*\.md$' || true)
fi

[ -z "$FILES" ] && echo "  ✓ 无 kb/ 文件需检查" && exit 0

TODAY_TS=$(date +%s)
STALE_DAYS=30

while IFS= read -r file; do
  [ -f "$file" ] || continue
  ISSUES=""

  # 检查 1: 交叉链接（相关/关联/[[...]]）
  if ! grep -qE '相关[：:]|\[\[.*\]\]|关联[：:]' "$file" 2>/dev/null; then
    ISSUES="${ISSUES}缺交叉链接 "
  fi

  # 检查 2: 具象元素（mermaid / 代码块 / 表格）
  HAS_CONCRETE=0
  grep -q '```mermaid' "$file" 2>/dev/null && HAS_CONCRETE=1
  [ "$HAS_CONCRETE" -eq 0 ] && grep -q '```' "$file" 2>/dev/null && HAS_CONCRETE=1
  [ "$HAS_CONCRETE" -eq 0 ] && grep -qE '^\|.*\|.*\|' "$file" 2>/dev/null && HAS_CONCRETE=1
  if [ "$HAS_CONCRETE" -eq 0 ]; then
    ISSUES="${ISSUES}缺具象元素(mermaid/代码块/表格) "
  fi

  # 检查 3: 元信息头日期是否 >30 天
  META_DATE=$(grep -m1 '^> 最后整理:' "$file" 2>/dev/null | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1)
  if [ -n "$META_DATE" ]; then
    META_TS=$(date -j -f "%Y-%m-%d" "$META_DATE" +%s 2>/dev/null || date -d "$META_DATE" +%s 2>/dev/null || echo "")
    if [ -n "$META_TS" ]; then
      DIFF_DAYS=$(( (TODAY_TS - META_TS) / 86400 ))
      if [ "$DIFF_DAYS" -gt "$STALE_DAYS" ]; then
        ISSUES="${ISSUES}元信息头日期过旧(>${STALE_DAYS}天: ${META_DATE}) "
      fi
    fi
  fi

  if [ -n "$ISSUES" ]; then
    echo "  ⚠️  $file — $ISSUES"
    WARN_COUNT=$((WARN_COUNT + 1))
  fi
done <<< "$FILES"

if [ "$WARN_COUNT" -eq 0 ]; then
  echo "  ✓ 已检查 kb/ 文件，内容质量达标"
fi
