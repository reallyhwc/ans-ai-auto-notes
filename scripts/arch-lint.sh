#!/bin/bash
# KB 架构 Linter —— 机械检查知识库文件的架构合规性
# 理念（来自 Harness Engineering 三层模型）：
#   "写在 CLAUDE.md 里的规则是建议，跑在 hook 里的 linter 是法律。"
# 由 SessionStart hook 自动触发，不消耗 context，不依赖 AI 记忆。

cd "$(dirname "$0")/.."

PASS=0
FAIL=0
WARN=0

echo ""
echo "========== KB 架构 Linter =========="

# ── 检查 1: Frontmatter 完整性 ──
echo ""
echo "[1/5] Frontmatter 完整性 (title + description)..."

while IFS= read -r -d '' file; do
  HAS_TITLE=$(head -20 "$file" | grep -c "^title:" 2>/dev/null || echo "0")
  HAS_TITLE=$(echo "$HAS_TITLE" | awk '{print $1}')
  HAS_DESC=$(head -20 "$file" | grep -c "^description:" 2>/dev/null || echo "0")
  HAS_DESC=$(echo "$HAS_DESC" | awk '{print $1}')
  if [ "$HAS_TITLE" = "0" ] || [ "$HAS_TITLE" = "0 " ]; then
    echo "  ❌ $file — 缺少 title"
    FAIL=$((FAIL + 1))
  elif [ "$HAS_DESC" -eq 0 ]; then
    echo "  ❌ $file — 缺少 description"
    FAIL=$((FAIL + 1))
  else
    PASS=$((PASS + 1))
  fi
done < <(find kb -name "*.md" -print0 2>/dev/null)

echo "  结果: $PASS 通过"

# ── 检查 2: 元信息头规范 ──
echo ""
echo "[2/5] 元信息头规范 (最后整理日期 + 来源)..."

while IFS= read -r -d '' file; do
  HAS_DATE=$(head -20 "$file" | grep -c "> 最后整理:" 2>/dev/null || echo 0)
  if [ "$HAS_DATE" -eq 0 ]; then
    echo "  ⚠️  $file — 缺少「> 最后整理: YYYY-MM-DD」"
    WARN=$((WARN + 1))
  fi
done < <(find kb -name "*.md" -print0 2>/dev/null)

echo "  结果: $WARN 个警告"

# ── 检查 3: 交叉链接有效性 ──
echo ""
echo "[3/5] 交叉链接有效性..."

LINK_WARN=0
while IFS= read -r -d '' file; do
  FILE_DIR=$(dirname "$file")
  # 提取 markdown 链接 [text](./path.md) 格式
  LINKS=$(grep -o '](\./[^)]*\.md)' "$file" 2>/dev/null | sed 's/](\.\///;s/)//')
  # 提取 [[./path.md]] 格式
  WIKI_LINKS=$(grep -o '\[\[\./[^]]*\.md\]\]' "$file" 2>/dev/null | sed 's/\[\[\.\///;s/\]\]//')

  for link in $LINKS $WIKI_LINKS; do
    # 处理相对路径
    TARGET="$FILE_DIR/$link"
    if [ ! -f "$TARGET" ]; then
      # 再试去参数的版本
      TARGET_CLEAN=$(echo "$TARGET" | sed 's/#.*//')
      if [ ! -f "$TARGET_CLEAN" ]; then
        echo "  ⚠️  $file → 死链: ./$link"
        LINK_WARN=$((LINK_WARN + 1))
        break  # 每个文件只报一次
      fi
    fi
  done
done < <(find kb -name "*.md" -print0 2>/dev/null)

echo "  结果: $LINK_WARN 个死链"

# ── 检查 4: 重复标题 ──
echo ""
echo "[4/5] 重复标题检查..."

DUP_FOUND=0
find kb -name "*.md" -print0 2>/dev/null | while IFS= read -r -d '' file; do
  head -10 "$file" | grep "^title:" | sed 's/^title: *//' | sed 's/^"//;s/"$//'
done | sort | uniq -d | while read -r dup; do
  if [ -n "$dup" ]; then
    echo "  ⚠️  重复标题: \"$dup\""
    echo "      $(grep -rl "^title:.*$dup" kb/ 2>/dev/null | paste -sd '，' -)"
  fi
done

# ── 检查 5: CLAUDE.md 目录结构与磁盘一致性 ──
echo ""
echo "[5/5] CLAUDE.md 知识库结构 vs 磁盘一致性..."

# 对比 kb/ 实际 md 数量和 INDEX.md 条目数量（不解析树形图，只做计数对比）
KB_MD_COUNT=$(find kb -name "*.md" -type f 2>/dev/null | wc -l | awk '{print $1}')
INDEX_COUNT=$(grep -c "^\- \[" INDEX.md 2>/dev/null || echo "0")

echo "  kb/ 实际 md 文件: $KB_MD_COUNT, INDEX.md 条目: $INDEX_COUNT"

if [ "$KB_MD_COUNT" != "$INDEX_COUNT" ]; then
  echo "  ⚠️  数量不一致！可能需要运行: node scripts/build-index.js"
fi

# ── 汇总 ──
echo ""
echo "========== Linter 汇总 =========="
echo "  通过: $PASS 文件 | 错误: $FAIL | 警告: $((WARN + LINK_WARN))"
if [ "$FAIL" -gt 0 ]; then
  echo "  ❌ 有 $FAIL 个错误需要修复（缺少 frontmatter title/description）"
fi
echo "=================================="
echo ""
