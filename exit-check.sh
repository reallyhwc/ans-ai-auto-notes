#!/bin/bash
# 会话退出自动检查 + session 日志存档 + 未 push 提醒
# 由 Stop hook 自动触发（.claude/settings.local.json）
# 不开 -e：每个检查独立，前面失败不应中断后续
set -uo pipefail
cd "$(dirname "$0")"

echo ""
echo "========== 退出检查 =========="

# [1/7] 格式检查
echo ""
echo "[1/7] 格式检查 (markdownlint)..."
bash lint.sh

# [2/7] Git 状态
echo ""
echo "[2/7] Git 状态..."
git status --short

# [3/7] INDEX.md 日期
echo ""
echo "[3/7] INDEX.md 日期..."
grep "最后更新" INDEX.md

# [4/7] overview.html 健康检查
echo ""
echo "[4/7] overview.html 健康检查..."
node scripts/check-overview.js

# [5/7] 生成 session 日志
echo ""
echo "[5/7] 生成 session 日志..."
bash scripts/session-log.sh

# [6/7] 权限审计
echo ""
echo "[6/7] 权限审计..."
bash scripts/permission-audit.sh

# [7/7] 未 push 检查（>5 个自动 push，但 main/master 永不自动 push）
echo ""
echo "[7/7] 未 push 检查..."

# 检查当前分支
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "HEAD")
REMOTE=$(git remote get-url origin 2>/dev/null || echo "")

# 计算未 push 的 commit 数量（detached HEAD 或无 upstream 时返回 0）
UNPUSHED_COUNT=$(git rev-list @{u}..HEAD --count 2>/dev/null || echo "0")
# 防御：确保是纯数字（避免 [ -gt ] 报 syntax error）
[[ "$UNPUSHED_COUNT" =~ ^[0-9]+$ ]] || UNPUSHED_COUNT=0

# detached HEAD 跳过 push（无明确分支可推）
if [ "$BRANCH" = "HEAD" ]; then
  echo "  ⚠️  当前为 detached HEAD，跳过 push 检查"
elif [[ "$BRANCH" =~ ^(main|master)$ ]] && [ "$UNPUSHED_COUNT" -gt 0 ]; then
  # 保护性分支永不自动 push（哪怕 >5 commits 也只提醒，由人工确认）
  echo ""
  echo "  🛡️  保护分支 $BRANCH 有 $UNPUSHED_COUNT 个未 push commit"
  echo "  分支: $BRANCH → $REMOTE"
  echo "  原则: main/master 不自动 push，请人工确认后手动: git push origin $BRANCH"
elif [ "$UNPUSHED_COUNT" -gt 5 ]; then
  echo ""
  echo "  🚀 $UNPUSHED_COUNT 个 commit 未 push（>5），先跑测试..."
  if bash test.sh > /tmp/exit-check-test.log 2>&1; then
    PASS_LINE=$(grep -E "^# tests [0-9]+|ℹ tests" /tmp/exit-check-test.log | tail -1 || echo "")
    echo "  ✓ 测试通过 ($PASS_LINE)，自动 push..."
    if git push origin "$BRANCH" 2>&1; then
      echo "  ✅ 自动 push 成功"
    else
      echo "  ❌ 自动 push 失败，请手动: git push origin $BRANCH"
    fi
  else
    echo "  ❌ 测试失败，已阻断自动 push"
    echo "  详情: cat /tmp/exit-check-test.log"
    tail -10 /tmp/exit-check-test.log
    echo "  修复后手动: git push origin $BRANCH"
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
