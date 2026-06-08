#!/bin/bash
# 会话退出自动检查 + session 日志存档 + 未 push 提醒
# 由 Stop hook 自动触发（.claude/settings.local.json）
# 不开 -e：每个检查独立，前面失败不应中断后续
set -uo pipefail
cd "$(dirname "$0")"

echo ""
echo "========== 退出检查 =========="

# [1/11] 格式检查
echo ""
echo "[1/11] 格式检查 (markdownlint)..."
bash lint.sh

# [2/11] Git 状态
echo ""
echo "[2/11] Git 状态..."
git status --short

# [3/11] INDEX.md 存在性 + 与磁盘一致性
echo ""
echo "[3/11] INDEX.md 状态..."
if [ ! -f INDEX.md ]; then
  echo "  ❌ INDEX.md 不存在，请运行 node scripts/build-index.js"
else
  ENTRIES=$(grep -c "^\- \[" INDEX.md 2>/dev/null || echo 0)
  MDS=$(find kb -name "*.md" -type f 2>/dev/null | wc -l | awk '{print $1}')
  echo "  INDEX.md 条目: $ENTRIES, kb/ md 数: $MDS"
  [ "$ENTRIES" != "$MDS" ] && echo "  ⚠️  数量不一致，建议跑 node scripts/build-index.js"
  # 逐个验证 INDEX.md 中列出的文件确实存在（拦截"口头沉淀"——声称已创建但实际未写盘）
  MISSING_FILES=0
  while IFS= read -r line; do
    # 提取 ](path.md) 中的路径
    md_file=$(echo "$line" | sed 's/.*](\(.*\.md\)).*/\1/')
    [ -z "$md_file" ] && continue
    if [ ! -f "$md_file" ]; then
      echo "  ❌ 文件不存在: $md_file"
      MISSING_FILES=$((MISSING_FILES + 1))
    fi
  done < <(grep -o ']([^)]*\.md)' INDEX.md 2>/dev/null || true)
  [ "$MISSING_FILES" -gt 0 ] && echo "  ❌ $MISSING_FILES 个 INDEX.md 引用的文件不存在！请检查是否只写了文档但没创建文件"
fi

# [4/11] overview.html 健康检查
echo ""
echo "[4/11] overview.html 健康检查..."
node scripts/check-overview.js

# [5/11] 生成 session 日志
echo ""
echo "[5/11] 生成 session 日志..."
bash scripts/session-log.sh

# [6/11] 权限审计
echo ""
echo "[6/11] 权限审计..."
bash scripts/permission-audit.sh

# [7/11] 未 push 检查（≥5 个自动 push，所有分支统一规则）
# 设计取舍：单人知识库项目 + 永远在 main 工作，"main 保护"反而阻碍主流程
# 安全网由 pre-push hook 兜底：bash test.sh 通过 + mermaid 守恒检查
echo ""
echo "[7/11] 未 push 检查..."

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
elif [ "$UNPUSHED_COUNT" -ge 5 ]; then
  echo ""
  echo "  🚀 $UNPUSHED_COUNT 个 commit 未 push（≥5），先跑测试..."
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

# [8/11] 沉淀声明审计（B6：PostToolUse hook）
echo ""
echo "[8/11] 沉淀声明审计..."
LEDGER=".claude/claim-ledger.log"
if [ ! -f "$LEDGER" ]; then
  echo "  ✓ 无沉淀声明记录"
else
  MISSING_COUNT=$(grep -c " | MISSING$" "$LEDGER" 2>/dev/null || echo 0)
  if [ "$MISSING_COUNT" -gt 0 ]; then
    echo "  ❌ $MISSING_COUNT 次沉淀声明文件不存在："
    grep " | MISSING$" "$LEDGER" | tail -10
  else
    echo "  ✓ 所有沉淀声明文件均存在"
  fi
fi

# [9/11] plans 状态汇总（A7：复用 docs/superpowers/plans/）
echo ""
echo "[9/11] plans 状态汇总..."
node scripts/list-open-plans.js

# [10/11] agent-log patch 合规检查
echo ""
echo "[10/11] agent-log patch 合规..."
node scripts/check-agent-log-compliance.js

echo ""
echo "========== 退出检查完成 =========="
