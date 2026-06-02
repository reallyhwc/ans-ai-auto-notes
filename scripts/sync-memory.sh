#!/bin/bash
# sync-memory.sh — 双向同步 memory（mtime 较新者覆盖较旧者）
# 用法: bash scripts/sync-memory.sh [SIDE_A] [SIDE_B]
#   默认 SIDE_A: ~/.claude/projects/<project-path-dashed>/memory （Claude Code 真实存储）
#   默认 SIDE_B: <main-worktree>/.claude/memory-snapshot     （仓内可入 git 的快照）
# 同步范围：受 SIDE_B/.allowlist 约束（每行一个文件名，# 开头为注释）
set -uo pipefail

# 解析「主仓根」和「当前 worktree 根」——主仓决定 Claude Code memory 路径，worktree 决定 snapshot 物理位置
resolve_main_repo() {
  local common_dir
  common_dir=$(git rev-parse --git-common-dir 2>/dev/null) || { pwd; return; }
  case "$common_dir" in
    /*) (cd "$common_dir/.." && pwd) ;;
    *)  (cd "$(pwd)/$common_dir/.." && pwd) ;;
  esac
}

resolve_worktree_root() {
  git rev-parse --show-toplevel 2>/dev/null || pwd
}

MAIN_REPO=$(resolve_main_repo)
WORKTREE_ROOT=$(resolve_worktree_root)
DEFAULT_A="$HOME/.claude/projects/$(echo "$MAIN_REPO" | tr '/' '-')/memory"
DEFAULT_B="$WORKTREE_ROOT/.claude/memory-snapshot"

SIDE_A="${1:-$DEFAULT_A}"
SIDE_B="${2:-$DEFAULT_B}"

if [ ! -d "$SIDE_A" ]; then
  echo "❌ SIDE_A 不存在: $SIDE_A"
  exit 1
fi
mkdir -p "$SIDE_B"

ALLOWLIST="$SIDE_B/.allowlist"
if [ ! -f "$ALLOWLIST" ]; then
  echo "⚠️  allowlist 不存在: $ALLOWLIST （创建空 allowlist，不同步任何文件）"
  touch "$ALLOWLIST"
fi

SYNC_COUNT=0
while IFS= read -r name || [ -n "$name" ]; do
  [ -z "$name" ] && continue
  [ "${name:0:1}" = "#" ] && continue
  FA="$SIDE_A/$name"
  FB="$SIDE_B/$name"
  if [ ! -f "$FA" ] && [ ! -f "$FB" ]; then
    continue
  fi
  if [ -f "$FA" ] && [ ! -f "$FB" ]; then
    cp -p "$FA" "$FB"
    echo "  ✓ A → B: $name (新文件)"
    SYNC_COUNT=$((SYNC_COUNT + 1))
    continue
  fi
  if [ ! -f "$FA" ] && [ -f "$FB" ]; then
    cp -p "$FB" "$FA"
    echo "  ✓ B → A: $name (新文件)"
    SYNC_COUNT=$((SYNC_COUNT + 1))
    continue
  fi
  MA=$(stat -f %m "$FA" 2>/dev/null || stat -c %Y "$FA" 2>/dev/null)
  MB=$(stat -f %m "$FB" 2>/dev/null || stat -c %Y "$FB" 2>/dev/null)
  if [ "$MA" -gt "$MB" ]; then
    cp -p "$FA" "$FB"
    echo "  ✓ A → B: $name (A 较新)"
    SYNC_COUNT=$((SYNC_COUNT + 1))
  elif [ "$MB" -gt "$MA" ]; then
    cp -p "$FB" "$FA"
    echo "  ✓ B → A: $name (B 较新)"
    SYNC_COUNT=$((SYNC_COUNT + 1))
  fi
done < "$ALLOWLIST"

echo "完成：$SYNC_COUNT 个文件同步"
