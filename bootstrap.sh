#!/bin/bash
# bootstrap.sh — 新设备一键 onboarding
# 每步失败即终止 + 打印诊断
set -e

cd "$(dirname "$0")"

echo "========== ANS AI Auto Notes — Bootstrap =========="
echo ""

# [1/6] 探测 Claude Code 版本
echo "[1/6] 探测 Claude Code..."
if ! command -v claude >/dev/null 2>&1; then
  echo "❌ claude 命令未找到。请先安装：https://docs.claude.com/claude-code"
  exit 1
fi
echo "  ✓ Claude Code 已安装：$(claude --version 2>&1 | head -1)"

# [2/6] 安装 git pre-push hook
echo ""
echo "[2/6] 安装 git pre-push hook..."
bash scripts/install-hooks.sh
echo "  ✓ pre-push hook 已配置"

# [3/6] 检查 ~/.claude/settings.json
echo ""
echo "[3/6] 检查全局 Claude Code 配置..."
GLOBAL_SETTINGS="$HOME/.claude/settings.json"
if [ ! -f "$GLOBAL_SETTINGS" ]; then
  echo "  ⚠️  $GLOBAL_SETTINGS 不存在"
  echo "      请手动创建，至少包含：{\"theme\":\"dark\"}"
  echo "      （继续 bootstrap，但 Claude Code 行为可能受影响）"
else
  echo "  ✓ 全局配置存在"
fi

# [4/6] 初始化 memory（从 snapshot）
echo ""
echo "[4/6] 初始化 memory（从 snapshot 同步到本机）..."
# 主仓路径用 git-common-dir 解析（worktree 安全），保证与 sync-memory.sh 一致
MAIN_REPO=$(cd "$(git rev-parse --git-common-dir)/.." && pwd)
MEM_DIR="$HOME/.claude/projects/$(echo "$MAIN_REPO" | tr '/' '-')/memory"
mkdir -p "$MEM_DIR"
if [ -d ".claude/memory-snapshot" ]; then
  bash scripts/sync-memory.sh
  echo "  ✓ memory 已同步"
else
  echo "  ⚠️  .claude/memory-snapshot/ 不存在，跳过"
fi

# [5/6] 构建索引（manifest + INDEX + timeline）
echo ""
echo "[5/6] 构建 manifest.json + INDEX.md + timeline.json..."
node scripts/build-index.js
node scripts/build-timeline.js
echo "  ✓ 索引已构建"

# [6/6] 跑测试验证
echo ""
echo "[6/6] 跑测试验证..."
if bash test.sh > /tmp/bootstrap-test.log 2>&1; then
  PASS_LINE=$(grep -E "^# tests|ℹ tests" /tmp/bootstrap-test.log | tail -1 || echo "")
  echo "  ✓ 所有测试通过 ($PASS_LINE)"
else
  echo "  ❌ 测试失败，bootstrap 未完全成功"
  echo "  详情: cat /tmp/bootstrap-test.log"
  tail -20 /tmp/bootstrap-test.log
  exit 1
fi

echo ""
echo "========== Bootstrap 完成 =========="
echo ""
echo "下一步："
echo "  - 启动本地预览：./serve.sh"
echo "  - 开始用 Claude Code 在此项目工作"
echo ""
