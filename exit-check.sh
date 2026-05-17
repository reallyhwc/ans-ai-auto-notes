#!/bin/bash
# 会话退出自动检查 + session 日志存档
# 由 Stop hook 自动触发（.claude/settings.local.json）
cd "$(dirname "$0")"

echo ""
echo "========== 退出检查 =========="

# [1/5] 格式检查
echo ""
echo "[1/5] 格式检查 (markdownlint)..."
bash lint.sh

# [2/5] Git 状态
echo ""
echo "[2/5] Git 状态..."
git status --short

# [3/5] INDEX.md 日期
echo ""
echo "[3/5] INDEX.md 日期..."
grep "最后更新" INDEX.md

# [4/5] overview.html 健康检查
echo ""
echo "[4/5] overview.html 健康检查..."
node scripts/check-overview.js

# [5/5] 生成 session 日志 + 建议 commit 消息
echo ""
echo "[5/5] 生成 session 日志..."
bash scripts/session-log.sh

echo ""
echo "========== 退出检查完成 =========="

# 如果有未提交变更，给出明确提示
HAS_CHANGES=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
if [ "$HAS_CHANGES" -gt 0 ]; then
  echo ""
  echo "⚠️  有 $HAS_CHANGES 个未提交变更。请 AI 执行 git commit。"
  echo ""
  echo "   检查清单:"
  echo "   □ 交叉链接: 新文件已双向链接到关联文件？"
  echo "   □ Memory: 用户新偏好/反馈已写入 memory/？"
  echo "   □ Git: git add -A && git commit"
  echo ""
fi
