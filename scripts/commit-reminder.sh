#!/bin/bash
# Commit Reminder —— 非 LLM 约束，每次用户发消息时自动检查未提交变更
# 由 UserPromptSubmit hook 触发（.claude/settings.local.json）
# 理念：不在对话层靠"说"，在约束层靠"执行"

cd "$(dirname "$0")/.."

COUNT=$(git status --porcelain 2>/dev/null | wc -l | awk '{print $1}')

if [ "$COUNT" = "0" ] || [ -z "$COUNT" ]; then
  # Clean — 不输出任何东西，零干扰
  exit 0
fi

# 有未提交变更 → 根据数量分级提醒
if [ "$COUNT" -le 2 ] 2>/dev/null; then
  echo ""
  echo "💡 $COUNT 个文件未提交 — 顺手 commit 一下？"
  echo ""
elif [ "$COUNT" -le 5 ] 2>/dev/null; then
  echo ""
  echo "⚠️  $COUNT 个文件未提交 — 建议先 commit 再继续"
  echo "   git add -A && git commit -m \"docs: ...\""
  echo ""
else
  echo ""
  echo "🚨 $COUNT 个文件未提交！变更堆积过多，强烈建议立即 commit"
  echo "   git add -A && git commit -m \"docs: ...\""
  echo ""
fi
