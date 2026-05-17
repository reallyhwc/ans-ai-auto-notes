#!/bin/bash
# 自动生成 session 日志 —— 从 git 信息提取变更摘要，持久化到文件
# 用法: bash scripts/session-log.sh [--quiet]
#   --quiet  静默模式，只写文件不输出（用于 hook 自动触发）

cd "$(dirname "$0")/.."

DATE=$(date +%Y-%m-%d)
TIME=$(date +%H:%M)
LOG_DIR=".claude/session-logs"
LOG_FILE="$LOG_DIR/$DATE.md"

mkdir -p "$LOG_DIR"

# Git 输出用 core.quotepath=false 避免中文路径被编码
GIT="git -c core.quotepath=false"

# 收集变更数据
CHANGED_FILES=$($GIT diff --name-only 2>/dev/null | wc -l | awk '{print $1}')
NEW_FILES=$($GIT ls-files --others --exclude-standard 2>/dev/null | grep "\.md$" | wc -l | awk '{print $1}')
ADDED=$($GIT diff --stat 2>/dev/null | tail -1 | grep -o '[0-9]* insertion' | grep -o '[0-9]*' || echo "0")
DELETED=$($GIT diff --stat 2>/dev/null | tail -1 | grep -o '[0-9]* deletion' | grep -o '[0-9]*' || echo "0")
COMMITS_TODAY=$($GIT log --oneline --since="$DATE 00:00" --until="$DATE 23:59" 2>/dev/null | wc -l | awk '{print $1}')

# 变更文件列表（取前 20 个，去重）
FILE_LIST=$( {
  $GIT diff --name-only 2>/dev/null
  $GIT diff --cached --name-only 2>/dev/null
  $GIT ls-files --others --exclude-standard 2>/dev/null | grep "\.md$"
} | sort -u | head -20)

# 主要变更方向（从文件路径推断）
MAIN_TOPICS=""
if [ -n "$FILE_LIST" ]; then
  MAIN_TOPICS=$(echo "$FILE_LIST" | while read f; do
    echo "$f" | sed -n 's|kb/[^/]*/\([^/]*\)/.*|\1|p'
  done | sort -u | head -5 | paste -sd '，' -)
fi

# 生成建议的 commit message
SUGGESTED_COMMIT=""
if [ -n "$FILE_LIST" ]; then
  HAS_NEW=$($GIT ls-files --others --exclude-standard 2>/dev/null | grep -c "\.md$" || echo "0")
  HAS_NEW=$(echo "$HAS_NEW" | awk '{print $1}')

  # 提取简短文件名（不含路径前缀）用于 commit message
  NEW_TOPICS=$($GIT ls-files --others --exclude-standard 2>/dev/null | grep "\.md$" | while read f; do
    basename "$f" .md 2>/dev/null
  done | paste -sd '，' -)
  MOD_TOPICS=$($GIT diff --name-only 2>/dev/null | while read f; do
    basename "$f" .md 2>/dev/null
  done | sort -u | head -5 | paste -sd '，' -)

  if [ "$HAS_NEW" -gt 0 ] 2>/dev/null && [ -n "$MOD_TOPICS" ]; then
    SUGGESTED_COMMIT="docs: 新增 $NEW_TOPICS + 更新 $MOD_TOPICS"
  elif [ "$HAS_NEW" -gt 0 ] 2>/dev/null; then
    SUGGESTED_COMMIT="docs: 新增 $NEW_TOPICS"
  elif [ -n "$MOD_TOPICS" ]; then
    SUGGESTED_COMMIT="docs: 更新 $MOD_TOPICS"
  fi
fi

# 构建日志内容
cat > "$LOG_FILE" << EOF
## $DATE Session

- **时间**: ~$TIME
- **文件变更**: $CHANGED_FILES files modified, +$ADDED/-$DELETED lines
- **新增文件**: $NEW_FILES
- **今日 Commits**: $COMMITS_TODAY
EOF

if [ -n "$MAIN_TOPICS" ]; then
  echo "- **涉及主题**: $MAIN_TOPICS" >> "$LOG_FILE"
fi

echo "" >> "$LOG_FILE"
echo "### 变更文件" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

if [ -n "$FILE_LIST" ]; then
  echo "$FILE_LIST" | while read f; do
    if [ -f "$f" ]; then
      echo "- \`$f\`" >> "$LOG_FILE"
    fi
  done
else
  echo "（无变更）" >> "$LOG_FILE"
fi

if [ -n "$SUGGESTED_COMMIT" ]; then
  echo "" >> "$LOG_FILE"
  echo "### 建议 Commit" >> "$LOG_FILE"
  echo "" >> "$LOG_FILE"
  echo '```' >> "$LOG_FILE"
  echo "$SUGGESTED_COMMIT" >> "$LOG_FILE"
  echo '```' >> "$LOG_FILE"
fi

# 输出
if [ "$1" != "--quiet" ]; then
  echo ""
  echo "========== Session 日志 =========="
  cat "$LOG_FILE"
  echo ""
  echo "日志已保存: $LOG_FILE"
  echo ""
  if [ -n "$SUGGESTED_COMMIT" ]; then
    echo "💡 建议提交命令:"
    echo "   git add -A && git commit -m \"$SUGGESTED_COMMIT\""
    echo ""
  fi
fi
