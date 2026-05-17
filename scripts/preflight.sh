#!/bin/bash
# SessionStart 预检：环境体检 + 架构守卫 + memory 淘汰提醒
# 理念（来自 Harness Engineering 三层模型）：
#   约束层 = hooks + linter，机器执行，不依赖 AI 记忆
#   文档层 = session-log + memory，文件系统持久化
# 由 SessionStart hook 自动触发（.claude/settings.local.json）

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

# ── 4. INDEX.md 日期检查 ──
INDEX_DATE=$(grep "最后更新" INDEX.md 2>/dev/null | grep -o "[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}")
if [ "$INDEX_DATE" != "$TODAY" ] && [ -n "$INDEX_DATE" ]; then
  echo ""
  echo "⚠️  INDEX.md 日期 ($INDEX_DATE) 不是今天 ($TODAY)，可能需要运行 build-index.js"
fi

# ── 5. Memory 淘汰检查 (项目层文件 > 14 天未更新) ──
echo ""
echo "── Memory 淘汰检查 ──"
MEMORY_DIR="$HOME/.claude/projects/-Users-xuhu-workspace-ans-ai-auto-notes/memory"
STALE_COUNT=0
if [ -d "$MEMORY_DIR" ]; then
  TWO_WEEKS_AGO=$(date -v-14d +%Y-%m-%d 2>/dev/null || date -d "14 days ago" +%Y-%m-%d 2>/dev/null || echo "")
  if [ -n "$TWO_WEEKS_AGO" ]; then
    for f in "$MEMORY_DIR"/*.md; do
      [ "$(basename "$f")" = "MEMORY.md" ] && continue
      LAST_UP=$(grep "^lastUpdated:" "$f" 2>/dev/null | grep -o "[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}" | head -1)
      if [ -n "$LAST_UP" ] && [[ "$LAST_UP" < "$TWO_WEEKS_AGO" ]]; then
        DAYS_AGO=$(( ($(date -j -f "%Y-%m-%d" "$TODAY" +%s 2>/dev/null) - $(date -j -f "%Y-%m-%d" "$LAST_UP" +%s 2>/dev/null)) / 86400 ))
        echo "  ⚠️  可能过期: $(basename "$f") — 上次更新 $LAST_UP (${DAYS_AGO}天前)"
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
