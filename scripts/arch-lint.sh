#!/bin/bash
# KB 架构 Linter —— 机械检查知识库文件的架构合规性
# 理念（来自 Harness Engineering 三层模型）：
#   "写在 CLAUDE.md 里的规则是建议，跑在 hook 里的 linter 是法律。"
# 由 SessionStart hook 自动触发，不消耗 context，不依赖 AI 记忆。
set -uo pipefail

cd "$(dirname "$0")/.."

PASS=0
FAIL=0
WARN=0

echo ""
echo "========== KB 架构 Linter =========="

# ── 检查 1: Frontmatter 完整性 ──
echo ""
echo "[1/10] Frontmatter 完整性 (title + description)..."

while IFS= read -r -d '' file; do
  # 只检查 frontmatter 区域（前 20 行）
  HEAD=$(head -20 "$file")
  HAS_TITLE=$(echo "$HEAD" | grep -c "^title:" 2>/dev/null || echo "0")
  HAS_TITLE=$(echo "$HAS_TITLE" | awk '{print $1}')
  HAS_DESC=$(echo "$HEAD" | grep -c "^description:" 2>/dev/null || echo "0")
  HAS_DESC=$(echo "$HAS_DESC" | awk '{print $1}')

  # title 和 description 都必须存在
  MISSING=""
  if [ "$HAS_TITLE" = "0" ] || [ "$HAS_TITLE" = "0 " ]; then
    MISSING="title"
  fi
  if [ "$HAS_DESC" = "0" ] || [ "$HAS_DESC" = "0 " ]; then
    if [ -n "$MISSING" ]; then
      MISSING="$MISSING + description"
    else
      MISSING="description"
    fi
  fi

  if [ -n "$MISSING" ]; then
    echo "  ❌ $file — 缺少 $MISSING"
    FAIL=$((FAIL + 1))
  else
    PASS=$((PASS + 1))
  fi
done < <(find kb -name "*.md" -print0 2>/dev/null)

echo "  结果: $PASS 通过, $FAIL 失败"

# ── 检查 2: 元信息头规范 ──
echo ""
echo "[2/10] 元信息头规范 (最后整理日期 + 来源)..."

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
echo "[3/10] 交叉链接有效性..."

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
echo "[4/10] 重复标题检查..."

DUP_FOUND=0
# 用进程替换收集所有 title，避免 pipeline 子 shell 计数丢失
DUPS=$(
  while IFS= read -r -d '' file; do
    head -10 "$file" | grep "^title:" | sed 's/^title: *//;s/^"//;s/"$//'
  done < <(find kb -name "*.md" -print0 2>/dev/null) | sort | uniq -d
)
if [ -n "$DUPS" ]; then
  while IFS= read -r dup; do
    [ -z "$dup" ] && continue
    echo "  ⚠️  重复标题: \"$dup\""
    echo "      $(grep -rl "^title:.*$dup" kb/ 2>/dev/null | paste -sd '，' -)"
    DUP_FOUND=$((DUP_FOUND + 1))
  done <<< "$DUPS"
fi
[ "$DUP_FOUND" -eq 0 ] && echo "  ✓ 无重复标题"

# ── 检查 5: CLAUDE.md 目录结构与磁盘一致性 ──
echo ""
echo "[5/10] CLAUDE.md 知识库结构 vs 磁盘一致性..."

# 对比 kb/ 实际 md 数量和 INDEX.md 条目数量（不解析树形图，只做计数对比）
KB_MD_COUNT=$(find kb -name "*.md" -type f 2>/dev/null | wc -l | awk '{print $1}')
INDEX_COUNT=$(grep -c "^\- \[" INDEX.md 2>/dev/null || echo "0")

echo "  kb/ 实际 md 文件: $KB_MD_COUNT, INDEX.md 条目: $INDEX_COUNT"

if [ "$KB_MD_COUNT" != "$INDEX_COUNT" ]; then
  echo "  ⚠️  数量不一致！可能需要运行: node scripts/build-index.js"
fi

# ── 检查 6: 链接路径大小写一致性 ──
# macOS 文件系统不区分大小写（HFS+/APFS 默认），但 Linux/GitHub 区分。
# 此检查逐段比较链接路径中的每个目录/文件名与磁盘实际大小写是否一致。
echo ""
echo "[6/10] 链接路径大小写一致性（Linux 兼容）..."

CASE_WARN=0
while IFS= read -r -d '' file; do
  FILE_DIR=$(dirname "$file")
  # 提取所有相对路径的 md 链接：](../xxx.md) 和 ](./xxx.md) 格式，去掉锚点
  LINKS=$(grep -oE ']\([.]{1,2}/[^)]+\.md[^)]*\)' "$file" 2>/dev/null | sed 's/](\(.*\))/\1/' | sed 's/#.*//')

  for link in $LINKS; do
    # 用 python3 逐段比较：将链接解析为绝对路径，再逐个路径段对比磁盘实际名称
    MISMATCH=$(python3 -c "
import os, sys
file_dir = '$FILE_DIR'
link = '$link'
# 将相对链接解析为绝对路径
abs_link = os.path.normpath(os.path.join(file_dir, link))
# 逐段检查每个路径段的大小写是否与磁盘一致
parts = abs_link.split(os.sep)
current = os.sep
for part in parts:
    if not part:
        continue
    current = os.path.join(current, part)
    parent = os.path.dirname(current)
    if not os.path.isdir(parent):
        break
    try:
        entries = os.listdir(parent)
    except OSError:
        break
    # 在父目录中找到实际名称（大小写敏感匹配）
    if part not in entries:
        # 大小写不一致：part 在磁盘上不存在（但 macOS 可能忽略大小写找到了）
        # 确认是大小写问题而非真正缺失
        lower_matches = [e for e in entries if e.lower() == part.lower()]
        if lower_matches:
            print(f'{part} -> {lower_matches[0]}')
            sys.exit(0)
        break
" 2>/dev/null)

    if [ -n "$MISMATCH" ]; then
      echo "  ⚠️  $file"
      echo "      链接中: $link"
      echo "      大小写不一致: $MISMATCH"
      CASE_WARN=$((CASE_WARN + 1))
      break  # 每个文件只报一次
    fi
  done
done < <(find kb -name "*.md" -print0 2>/dev/null)

echo "  结果: $CASE_WARN 个大小写不一致"

# ── 检查 7: 文件行数超标 ──
# 知识笔记含大量 demo/Mermaid/代码块，单文件控制在 1000 行以内，超 1500 报错
echo ""
echo "[7/10] 文件行数超标检查 (>1000 警告, >1500 错误)..."

LINE_WARN=0
LINE_ERR=0
while IFS= read -r -d '' file; do
  LINES=$(wc -l < "$file" | awk '{print $1}')
  if [ "$LINES" -gt 1500 ]; then
    echo "  ❌ $file — $LINES 行 (>1500，必须拆分)"
    LINE_ERR=$((LINE_ERR + 1))
    FAIL=$((FAIL + 1))
  elif [ "$LINES" -gt 1000 ]; then
    echo "  ⚠️  $file — $LINES 行 (>1000，关注)"
    LINE_WARN=$((LINE_WARN + 1))
  fi
done < <(find kb -name "*.md" -print0 2>/dev/null)

echo "  结果: $LINE_ERR 个超标错误, $LINE_WARN 个警告"

# ── 检查 8: Memory 文件 frontmatter 格式 ──
# 检查 memory/*.md 的 frontmatter --- 分隔符是否正确闭合
echo ""
echo "[8/10] Memory 文件 frontmatter 格式..."

MEM_WARN=0
for file in memory/*.md; do
  [ -f "$file" ] || continue
  # 检查文件是否以 --- 开头且有正确闭合的第二个 ---
  FIRST_LINE=$(head -1 "$file")
  if [ "$FIRST_LINE" = "---" ]; then
    # 找第二个 ---（从第 2 行开始）
    CLOSE_LINE=$(tail -n +2 "$file" | grep -n "^---$" | head -1 | cut -d: -f1)
    if [ -z "$CLOSE_LINE" ]; then
      echo "  ⚠️  $file — frontmatter 未正确闭合（缺少结尾 ---）"
      MEM_WARN=$((MEM_WARN + 1))
    else
      # 检查闭合 --- 前一行是否有内容粘连（如 lastUpdated: 2026-05-17---）
      CLOSE_ACTUAL=$((CLOSE_LINE + 1))
      PREV_LINE=$(sed -n "${CLOSE_LINE}p" <(tail -n +2 "$file"))
      if echo "$PREV_LINE" | grep -q '---$' 2>/dev/null && [ "$PREV_LINE" != "---" ]; then
        echo "  ⚠️  $file — 第 $((CLOSE_LINE + 1)) 行疑似 --- 粘连: \"$PREV_LINE\""
        MEM_WARN=$((MEM_WARN + 1))
      fi
    fi
  fi
done

echo "  结果: $MEM_WARN 个格式问题"

# ── 检查 9: 零 npm 依赖 enforce ──
# 项目承诺零 npm/yarn/pnpm 依赖（见 memory: feedback-zero-npm-deps）
# 这是"代码层"的物理 enforce，文档约定不可靠（CLAUDE.md 写过但 lint.sh 曾用 npx 跑了几个月）
# 误报豁免：行内追加 # ALLOW-DEP 注释即跳过
echo ""
echo "[9/10] 零 npm 依赖 enforce..."

DEPS_ISSUES=0

# 9a) 检查 package.json / node_modules
if [ -f package.json ]; then
  echo "  ❌ 项目根目录出现 package.json（违反零 npm 依赖原则）"
  DEPS_ISSUES=$((DEPS_ISSUES + 1))
  FAIL=$((FAIL + 1))
fi
if [ -d node_modules ]; then
  echo "  ⚠️  项目根目录出现 node_modules（应加 .gitignore + 清理）"
  DEPS_ISSUES=$((DEPS_ISSUES + 1))
fi

# 9b) 扫描 .sh / .js 中的 npm / npx / yarn / pnpm 调用
# 用 awk 去掉行尾注释后再匹配，避免"# 提到 npm"的误报
while IFS= read -r f; do
  # 跳过本文件（本身要提及这些关键字作为检测目标）
  [ "$(realpath "$f" 2>/dev/null)" = "$(realpath "$0" 2>/dev/null)" ] && continue
  HITS=$(awk '
    # 整行注释跳过
    /^[[:space:]]*(#|\/\/)/ { next }
    # 行尾豁免标记跳过
    /# ?ALLOW-DEP/ { next }
    {
      # 去掉行尾 # 注释 和 // 注释（粗略，shell 字符串中的 # 会被误删，但保守剔除是安全的）
      sub(/[[:space:]]+#.*$/, "")
      sub(/\/\/.*$/, "")
      if (match($0, /\<(npm|npx|yarn|pnpm)\>[[:space:]]+/)) {
        print NR": "$0
      }
    }
  ' "$f" 2>/dev/null)
  if [ -n "$HITS" ]; then
    echo "  ❌ $f"
    echo "$HITS" | sed 's/^/      /'
    DEPS_ISSUES=$((DEPS_ISSUES + 1))
    FAIL=$((FAIL + 1))
  fi
done < <(find . \( -name "*.sh" -o -name "*.js" \) -type f \
         -not -path "./node_modules/*" \
         -not -path "./.git/*" \
         -not -path "./demos/*" 2>/dev/null)

if [ "$DEPS_ISSUES" -eq 0 ]; then
  echo "  ✓ 零依赖原则未被违反"
fi
echo "  结果: $DEPS_ISSUES 个依赖问题"

# ── 检查 10: 脚本被引用一致性 ──
# 沉淀共性问题："文档先进了一步" —— CLAUDE.md/README 声称在 hook 链路里跑的脚本，
# 实际可能从未被调用（如 permission-audit.sh 曾是死代码几个月）。
# 此检查找出 scripts/*.sh 中未被任何调用方引用的"孤儿脚本"。
# 调用方白名单：exit-check.sh / preflight.sh / arch-lint.sh / install-hooks.sh /
#               git-hooks/* / test.sh / serve.sh / .claude/settings*.json
echo ""
echo "[10/10] 脚本被引用一致性..."

UNREF_COUNT=0
REFERENCING=(
  "exit-check.sh"
  "scripts/preflight.sh"
  "scripts/install-hooks.sh"
  "scripts/arch-lint.sh"
  "test.sh"
  "serve.sh"
  "server.js"
  "scripts/build-index.js"
  "scripts/check-overview.js"
  ".claude/settings.local.json"
  ".claude/settings.json"
)
# git-hooks/* 单独扫
GIT_HOOKS=$(find scripts/git-hooks -type f 2>/dev/null)

while IFS= read -r script; do
  SCRIPT_NAME=$(basename "$script")
  REFERENCED=0
  for ref in "${REFERENCING[@]}"; do
    [ -f "$ref" ] || continue
    # 排除自引用
    [ "$(realpath "$ref" 2>/dev/null)" = "$(realpath "$script" 2>/dev/null)" ] && continue
    if grep -q "$SCRIPT_NAME" "$ref" 2>/dev/null; then
      REFERENCED=1
      break
    fi
  done
  if [ $REFERENCED -eq 0 ] && [ -n "$GIT_HOOKS" ]; then
    if echo "$GIT_HOOKS" | xargs grep -l "$SCRIPT_NAME" 2>/dev/null | grep -q .; then
      REFERENCED=1
    fi
  fi
  if [ $REFERENCED -eq 0 ]; then
    echo "  ⚠️  $script 未在任何 hook/exit-check/手动入口中被引用（可能是死代码或文档未对齐）"
    UNREF_COUNT=$((UNREF_COUNT + 1))
  fi
done < <(find scripts -maxdepth 1 -name "*.sh" -type f 2>/dev/null)

if [ "$UNREF_COUNT" -eq 0 ]; then
  echo "  ✓ 所有 scripts/*.sh 都已被某个入口引用"
fi
echo "  结果: $UNREF_COUNT 个孤儿脚本"

# ── 汇总 ──
ALL_WARN=$((WARN + LINK_WARN + CASE_WARN + LINE_WARN + MEM_WARN + DEPS_ISSUES + UNREF_COUNT))
echo ""
echo "========== Linter 汇总 =========="
echo "  通过: $PASS 文件 | 错误: $FAIL | 警告: $ALL_WARN"
if [ "$FAIL" -gt 0 ]; then
  echo "  ❌ 有 $FAIL 个错误需要修复"
fi
if [ "$ALL_WARN" -gt 0 ]; then
  echo "  ⚠️  有 $ALL_WARN 个警告需要关注"
fi
if [ "$FAIL" -eq 0 ] && [ "$ALL_WARN" -eq 0 ]; then
  echo "  ✅ 全部通过！"
fi
echo "=================================="
echo ""
