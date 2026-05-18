#!/bin/bash
# 会话退出自动检查 + session 日志存档 + 未 push 提醒
# 由 Stop hook 自动触发（.claude/settings.local.json）
cd "$(dirname "$0")"

echo ""
echo "========== 退出检查 =========="

# [1/6] 格式检查
echo ""
echo "[1/6] 格式检查 (markdownlint)..."
bash lint.sh

# [2/6] Git 状态
echo ""
echo "[2/6] Git 状态..."
git status --short

# [3/6] INDEX.md 日期
echo ""
echo "[3/6] INDEX.md 日期..."
grep "最后更新" INDEX.md

# [4/6] overview.html 健康检查
echo ""
echo "[4/6] overview.html 健康检查..."
node scripts/check-overview.js

# [5/6] 生成 session 日志
echo ""
echo "[5/6] 生成 session 日志..."
bash scripts/session-log.sh

# [6/6] 未 push 检查（>5 个自动 push）
echo ""
echo "[6/6] 未 push 检查..."

# 检查当前分支
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
REMOTE=$(git remote get-url origin 2>/dev/null)

# 计算未 push 的 commit 数量
UNPUSHED_COUNT=$(git rev-list @{u}..HEAD --count 2>/dev/null || echo "0")

if [ "$UNPUSHED_COUNT" -gt 5 ]; then
  echo ""
  echo "  🚀 $UNPUSHED_COUNT 个 commit 未 push（>5），自动 push..."
  git push origin "$BRANCH" 2>&1
  if [ $? -eq 0 ]; then
    echo "  ✅ 自动 push 成功"
  else
    echo "  ❌ 自动 push 失败，请手动执行: git push origin $BRANCH"
  fi
elif [ "$UNPUSHED_COUNT" -gt 0 ]; then
  echo ""
  echo "  ⚠️  $UNPUSHED_COUNT 个 commit 未 push"
  echo "  分支: $BRANCH → $REMOTE"
  echo "  建议: git push origin $BRANCH"
else
  echo "  ✓ 所有 commit 已 push"
fi

echo ""
echo "========== 退出检查完成 =========="
