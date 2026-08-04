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

# core.quotepath=false：避免 git diff 把中文路径引号+八进制转义（"kb/\\346..."），
# 否则 grep '^kb/.*\.md$' 匹配不到任何中文名文件（原默认模式对中文名文件实际从未生效）
GIT="git -c core.quotepath=false"

if [ "${CQF_CHECK_ALL:-}" = "1" ]; then
  FILES=$(find kb -name "*.md" -type f 2>/dev/null)
else
  # 覆盖本 session 起点（修复：原 `git diff HEAD~1` 只覆盖最近 1 个 commit + 未提交区，
  # 多 commit session 会漏掉更早的 commit）。基线优先级：
  #   1) .claude/session-logs/.last-checkpoint —— session-log.sh 维护的会话边界（上次 Stop 的 HEAD）
  #   2) 今天最早 commit 的父提交（整个今日 session）
  # 两者皆无再退回 HEAD~1。
  BASE_SHA=""
  if [ -f .claude/session-logs/.last-checkpoint ]; then
    BASE_SHA=$(head -1 .claude/session-logs/.last-checkpoint 2>/dev/null)
    git rev-parse --quiet --verify "$BASE_SHA" >/dev/null 2>&1 || BASE_SHA=""
  fi
  if [ -z "$BASE_SHA" ]; then
    FIRST_TODAY=$($GIT log --format=%H --since="$(date +%Y-%m-%d) 00:00:00" 2>/dev/null | tail -1)
    if [ -n "$FIRST_TODAY" ]; then
      BASE_SHA=$(git rev-parse --quiet --verify "$FIRST_TODAY^" 2>/dev/null || echo "$FIRST_TODAY")
    fi
  fi
  if [ -n "$BASE_SHA" ]; then
    # 会话内已 commit 变更 + 未提交工作区 + 已暂存区 + 未跟踪新文件
    FILES=$( {
      $GIT diff --name-only "$BASE_SHA"..HEAD 2>/dev/null
      $GIT diff --name-only 2>/dev/null
      $GIT diff --cached --name-only 2>/dev/null
      $GIT ls-files --others --exclude-standard 2>/dev/null
    } | grep '^kb/.*\.md$' | LC_ALL=C sort -u )
  else
    FILES=$( { $GIT diff --name-only HEAD~1 2>/dev/null; $GIT diff --cached --name-only 2>/dev/null; } | grep '^kb/.*\.md$' | LC_ALL=C sort -u )
  fi
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
