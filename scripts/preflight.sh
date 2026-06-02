#!/bin/bash
# SessionStart 预检：环境体检 + 架构守卫 + memory 淘汰提醒
# 理念（来自 Harness Engineering 三层模型）：
#   约束层 = hooks + linter，机器执行，不依赖 AI 记忆
#   文档层 = session-log + memory，文件系统持久化
# 由 SessionStart hook 自动触发（.claude/settings.local.json）
set -uo pipefail

cd "$(dirname "$0")/.."

echo ""
echo "========== SessionStart 预检 =========="

# ── 1. 上次 session 遗留检查 ──
STALE_CHANGES=$(git status --porcelain 2>/dev/null | wc -l | awk '{print $1}')
if [ "$STALE_CHANGES" -gt 0 ] 2>/dev/null; then
  echo ""
  echo "⚠️  上次 session 遗留 $STALE_CHANGES 个未提交变更"
fi

# ── 2. 上次 session 摘要 ──
echo ""
TODAY=$(date +%Y-%m-%d)
YESTERDAY=$(date -v-1d +%Y-%m-%d 2>/dev/null || date -d "yesterday" +%Y-%m-%d 2>/dev/null || echo "")
LOG_DIR=".claude/session-logs"

# 找最近的非今日 session 日志
LAST_LOG=$(ls -t "$LOG_DIR"/*.md 2>/dev/null | grep -v "$TODAY" | head -1)
if [ -n "$LAST_LOG" ]; then
  LAST_DATE=$(basename "$LAST_LOG" .md)
  LAST_TOPIC=$(grep "涉及主题" "$LAST_LOG" 2>/dev/null | sed 's/.*: //')
  LAST_COMMITS=$(grep "今日 Commits" "$LAST_LOG" 2>/dev/null | sed 's/.*: //')
  echo "📋 上次 session: $LAST_DATE"
  if [ -n "$LAST_TOPIC" ]; then
    echo "   涉及: $LAST_TOPIC"
  fi
  echo "   Commits: $LAST_COMMITS 个"
else
  echo "📋 未找到历史 session 日志"
fi

# ── 3. manifest.json 过期检查 ──
if [ -f manifest.json ]; then
  NEWEST_MD=$(find kb -name "*.md" -newer manifest.json 2>/dev/null | wc -l | awk '{print $1}')
  if [ "$NEWEST_MD" -gt 0 ] 2>/dev/null; then
    echo ""
    echo "⚠️  $NEWEST_MD 个 md 文件比 manifest.json 新，建议运行: node scripts/build-index.js"
  fi
fi

# ── 4. (已移除) INDEX.md 日期检查 ──
# INDEX.md 不再包含动态日期（每次 SessionStart 都会改导致 git noise），
# manifest.json 过期检查（上一项）已能覆盖"索引需重建"的场景。

# ── 5. Memory 淘汰检查 (项目层文件 > 14 天未更新) ──
echo ""
echo "── Memory 淘汰检查 ──"
# 项目目录路径转 Claude memory 目录名（/ → -）
# 注意：projects/ 后接 - 开头的串（来源于路径开头的 /），中间必须保留 /
PROJECT_DIR=$(pwd)
MEMORY_DIR="$HOME/.claude/projects/$(echo "$PROJECT_DIR" | tr '/' '-')/memory"
STALE_COUNT=0
# 取数策略（按优先级）：
#   1. frontmatter 内 lastUpdated 字段（任意缩进，兼容 metadata 块内嵌套）
#   2. 文件 mtime（filesystem 是权威，老 memory 没字段时兜底）
if [ ! -d "$MEMORY_DIR" ]; then
  echo "  ⚠️  MEMORY_DIR 不存在: $MEMORY_DIR （跳过淘汰检查）"
else
  TWO_WEEKS_AGO_TS=$(date -v-14d +%s 2>/dev/null || date -d "14 days ago" +%s 2>/dev/null || echo "")
  NOW_TS=$(date +%s)
  if [ -n "$TWO_WEEKS_AGO_TS" ]; then
    for f in "$MEMORY_DIR"/*.md; do
      [ -e "$f" ] || continue
      [ "$(basename "$f")" = "MEMORY.md" ] && continue
      # 1) 先看 frontmatter 内 lastUpdated（去锚定，允许任意缩进）
      LAST_UP=$(grep "lastUpdated:" "$f" 2>/dev/null | grep -o "[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}" | head -1)
      if [ -n "$LAST_UP" ]; then
        LAST_TS=$(date -j -f "%Y-%m-%d" "$LAST_UP" +%s 2>/dev/null || date -d "$LAST_UP" +%s 2>/dev/null)
        SOURCE="frontmatter"
      else
        # 2) fallback：文件 mtime
        LAST_TS=$(stat -f "%m" "$f" 2>/dev/null || stat -c "%Y" "$f" 2>/dev/null)
        LAST_UP=$(date -r "$LAST_TS" +%Y-%m-%d 2>/dev/null || date -d "@$LAST_TS" +%Y-%m-%d 2>/dev/null)
        SOURCE="mtime"
      fi
      [ -z "$LAST_TS" ] && continue
      if [ "$LAST_TS" -lt "$TWO_WEEKS_AGO_TS" ]; then
        DAYS_AGO=$(( (NOW_TS - LAST_TS) / 86400 ))
        echo "  ⚠️  可能过期: $(basename "$f") — $LAST_UP (${DAYS_AGO}天前, $SOURCE)"
        STALE_COUNT=$((STALE_COUNT + 1))
      fi
    done
  fi
fi
if [ "$STALE_COUNT" -eq 0 ] 2>/dev/null; then
  echo "  ✓ 所有 memory 文件均在 2 周内有更新"
fi
echo "  （每月花 10 分钟 review 稳定层 MEMORY.md，删过时条目）"

# ── 6. 架构 Linter ──
echo ""
bash scripts/arch-lint.sh

echo "========== 预检完成 =========="
echo ""
