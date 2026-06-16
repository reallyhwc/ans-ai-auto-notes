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
echo "[1/15] Frontmatter 完整性 (title + description)..."

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
echo "[2/15] 元信息头规范 (最后整理日期 + 来源)..."

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
echo "[3/15] 交叉链接有效性..."

LINK_WARN=0
DEAD_LINKS=$(mktemp)
trap 'rm -f "$DEAD_LINKS"' EXIT

while IFS= read -r -d '' file; do
  FILE_DIR=$(dirname "$file")
  # Extract both ](./path.md) and [[./path.md]] links, one per line
  {
    grep -o '](\./[^)]*\.md)' "$file" 2>/dev/null | sed 's/](\.\///;s/)//'
    grep -o '\[\[\./[^]]*\.md\]\]' "$file" 2>/dev/null | sed 's/\[\[\.\///;s/\]\]//'
  } > "$DEAD_LINKS"

  while IFS= read -r link; do
    [ -z "$link" ] && continue
    TARGET="$FILE_DIR/$link"
    if [ ! -f "$TARGET" ]; then
      TARGET_CLEAN=$(echo "$TARGET" | sed 's/#.*//')
      if [ ! -f "$TARGET_CLEAN" ]; then
        echo "  ⚠️  $file → 死链: ./$link"
        LINK_WARN=$((LINK_WARN + 1))
        break
      fi
    fi
  done < "$DEAD_LINKS"
done < <(find kb -name "*.md" -print0 2>/dev/null)

# 3b) 含空格/& 的 .md 链接必须用 <尖括号> 包裹（CommonMark 严格解析）
# 否则 marked.js 不识别为链接，页面看似有链接但实际无法跳转。
# 扫描 kb/ + timeline/（手维护周记中也有大量 kb 链接）
# 修复脚本：node scripts/fix-md-link-spaces.js
UNQUOTED_LINKS=$(grep -rEn '\]\([^<)][^)]*[ &][^)]*\.md(#[^)]*)?\)' kb/ timeline/ 2>/dev/null | wc -l | awk '{print $1}')
if [ "$UNQUOTED_LINKS" -gt 0 ]; then
  echo "  ⚠️  $UNQUOTED_LINKS 个 .md 链接含空格/& 但未用 <尖括号> 包裹（marked 解析失败）"
  echo "      修复：node scripts/fix-md-link-spaces.js"
  LINK_WARN=$((LINK_WARN + UNQUOTED_LINKS))
fi

echo "  结果: $LINK_WARN 个死链"

# ── 检查 4: 重复标题 ──
echo ""
echo "[4/15] 重复标题检查..."

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
echo "[5/15] CLAUDE.md 知识库结构 vs 磁盘一致性..."

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
# 优化：用 bash-native 替代 python3 fork（3.10s → ~0.3s）
echo ""
echo "[6/15] 链接路径大小写一致性（Linux 兼容）..."

CASE_WARN=0
while IFS= read -r -d '' file; do
  FILE_DIR=$(dirname "$file")
  # 提取所有相对路径的 md 链接：](../xxx.md) 和 ](./xxx.md) 格式，去掉锚点
  LINKS=$(grep -oE ']\([.]{1,2}/[^)]+\.md[^)]*\)' "$file" 2>/dev/null | sed 's/](\(.*\))/\1/' | sed 's/#.*//')

  for link in $LINKS; do
    # bash-native 实现：将链接解析为绝对路径，逐段用 find -iname 查找磁盘实际名称
    abs_link="$FILE_DIR/$link"

    # 规范化路径（去掉多余的 ./ 和 ../）
    abs_link=$(cd "$FILE_DIR" 2>/dev/null && realpath -m "$link" 2>/dev/null || echo "$abs_link")

    # 逐段检查大小写
    IFS='/' read -ra parts <<< "$abs_link"
    current=""
    mismatch_found=0

    for part in "${parts[@]}"; do
      [ -z "$part" ] && continue

      if [ -z "$current" ]; then
        current="/$part"
        continue
      fi

      parent="$current"

      # 如果父目录不存在，跳出
      if [ ! -d "$parent" ]; then
        break
      fi

      # 精确匹配（大小写敏感）
      if [ -e "$parent/$part" ]; then
        current="$parent/$part"
        continue
      fi

      # 大小写不敏感查找（macOS BSD find 兼容）
      actual_name=$(find "$parent" -maxdepth 1 -iname "$part" 2>/dev/null | head -1 | xargs basename 2>/dev/null)

      if [ -n "$actual_name" ] && [ "$actual_name" != "$part" ]; then
        echo "  ⚠️  $file"
        echo "      链接中: $link"
        echo "      大小写不一致: $part -> $actual_name"
        CASE_WARN=$((CASE_WARN + 1))
        mismatch_found=1
        break
      elif [ -n "$actual_name" ]; then
        current="$parent/$actual_name"
      else
        break
      fi
    done

    [ "$mismatch_found" -eq 1 ] && break  # 每个文件只报一次
  done
done < <(find kb -name "*.md" -print0 2>/dev/null)

echo "  结果: $CASE_WARN 个大小写不一致"

# ── 检查 7: 文件行数超标 ──
# 知识笔记含大量 demo/Mermaid/代码块，单文件控制在 1000 行以内，超 1500 报错
echo ""
echo "[7/15] 文件行数超标检查 (>1000 警告, >1500 错误)..."

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
echo "[8/15] Memory 文件 frontmatter 格式..."

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
echo "[9/15] 零 npm 依赖 enforce..."

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
echo "[10/15] 脚本被引用一致性..."

UNREF_COUNT=0
REFERENCING=(
  "exit-check.sh"
  "scripts/preflight.sh"
  "scripts/install-hooks.sh"
  "scripts/arch-lint.sh"
  "test.sh"
  "serve.sh"
  "server.js"
  "bootstrap.sh"
  "scripts/build-index.js"
  "scripts/check-overview.js"
  ".claude/settings.local.json"
  ".claude/settings.json"
)
# git-hooks/* 单独扫
GIT_HOOKS=$(find scripts/git-hooks -type f 2>/dev/null)

while IFS= read -r script; do
  SCRIPT_NAME=$(basename "$script")
  # 豁免：脚本顶部含 `# arch-lint-ignore-unref:` 注释（如 PostToolUse hook script，
  # 由 settings.local.json 引用而非 hook 链路；该文件 .gitignore 不参与 scan）
  if head -5 "$script" 2>/dev/null | grep -q "^# arch-lint-ignore-unref:"; then
    continue
  fi
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

# ── 检查 11: 文档 → 代码引用一致性 ──
# 与 [10/15] 互补：[10/15] 是"代码 → 文档"（孤儿脚本），这一项是"文档 → 代码"
# CLAUDE.md / README.md 提到的脚本/文件路径必须真实存在
# 否则属于"文档先进了一步"或"代码挪动后文档没跟上"——本次审计已发现 3 处类似漂移
echo ""
echo "[11/15] 文档 → 代码引用一致性..."

DOC_REF_FAIL=0
for doc in CLAUDE.md README.md; do
  [ -f "$doc" ] || continue
  # 提取 scripts/xxx.{sh,js} 和 ./xxx.{sh,js} 形式的引用
  REFS=$(grep -oE '(scripts/|\./)[a-z_-]+\.(sh|js)' "$doc" 2>/dev/null | sort -u)
  for ref in $REFS; do
    # 标准化为相对项目根的路径
    target="${ref#./}"
    if [ ! -f "$target" ]; then
      echo "  ❌ $doc → 引用了不存在的文件: $ref"
      DOC_REF_FAIL=$((DOC_REF_FAIL + 1))
      FAIL=$((FAIL + 1))
    fi
  done
done

if [ "$DOC_REF_FAIL" -eq 0 ]; then
  echo "  ✓ 文档中引用的脚本/文件都存在"
fi
echo "  结果: $DOC_REF_FAIL 个文档引用问题"

# ── 检查 12: 标题 ID 生成契约 ──
# 该次审计产出：buildToc (lib.js) 和 heading renderer (app.js) 必须
# 使用一致的 slugify + token.text 预处理策略生成标题 id，否则 TOC 点击跳转
# 会静默失效（DOM id 与 TOC data-toc-id 不匹配）。
echo ""
echo "[12/15] 标题 ID 生成契约（lib.js buildToc ↔ app.js heading renderer）..."

ID_CONTRACT_FAIL=0

# 12a) lib.js 的 buildToc 必须在 slugify 前调用 stripInline
if ! grep -q 'stripInline' scripts/lib.js 2>/dev/null; then
  echo "  ❌ lib.js — buildToc 中缺少 stripInline 调用（内联代码会影响 slugify 输出）"
  ID_CONTRACT_FAIL=$((ID_CONTRACT_FAIL + 1))
  FAIL=$((FAIL + 1))
fi

# 12b) app.js 必须有显式 heading renderer 使用 slugify
if ! grep -q "heading:" scripts/app.js 2>/dev/null; then
  echo "  ❌ app.js — marked 配置中缺少显式 heading 渲染器（依赖默认 id 生成，无法保证一致性）"
  ID_CONTRACT_FAIL=$((ID_CONTRACT_FAIL + 1))
  FAIL=$((FAIL + 1))
else
  # 12c) heading renderer 内部必须调用 slugify
  if ! awk '/heading:/{found=1} found && /slugify/{print; exit}' scripts/app.js 2>/dev/null | grep -q slugify; then
    echo "  ❌ app.js — heading renderer 内部未调用 slugify()，id 可能不一致"
    ID_CONTRACT_FAIL=$((ID_CONTRACT_FAIL + 1))
    FAIL=$((FAIL + 1))
  fi
fi

# 12d) lib.js 和 app.js 必须引用同一个 slugify 签名（都来自 lib.js 或相同实现）
LIB_SLUGIFY=$(grep -o "function slugify([^)]*)" scripts/lib.js 2>/dev/null | head -1)
if [ -z "$LIB_SLUGIFY" ]; then
  echo "  ❌ lib.js — slugify 函数定义丢失"
  ID_CONTRACT_FAIL=$((ID_CONTRACT_FAIL + 1))
  FAIL=$((FAIL + 1))
fi

if [ "$ID_CONTRACT_FAIL" -eq 0 ]; then
  echo "  ✓ 标题 ID 契约一致（stripInline + slugify in buildToc, heading renderer in app.js）"
fi
echo "  结果: $ID_CONTRACT_FAIL 个契约问题"

# ── 检查 13: 章节编号连续性 ──
# 对使用 "## N." 样式编号的 kb 文件，验证 h2 编号无跳号。
# 如 mcp-protocol.md 从 2 开始（缺失 1），llm-agent-mcp.md 曾 1.7 后直接跳到 3。
# 跳过不适用编号约定（日期/中文数字/§/Level N 等）的文件。
echo ""
echo "[13/15] 章节编号连续性（## N. 样式，无跳号）..."

NUM_GAP_WARN=0
while IFS= read -r -d '' file; do
  # 提取所有 "## N." 形式的 h2 编号，输出为空格分隔的数字序列
  NUMS=$(grep -E '^## [0-9]+\. ' "$file" 2>/dev/null | sed 's/^## //' | sed 's/\..*//' | sort -n | tr '\n' ' ')
  if [ -z "$NUMS" ]; then
    continue  # 不使用 ## N. 编号约定，跳过
  fi

  # 用 awk 检测跳号：第一项决定起始期望值（允许 0-based 或 1-based）
  HAS_GAP=$(echo "$NUMS" | awk '{ expected=($1==0 ? 0 : 1); for (i=1; i<=NF; i++) { if ($i != expected) { print "gap"; exit } expected=$i+1 } }' 2>/dev/null)
  if [ -n "$HAS_GAP" ]; then
    echo "  ⚠️  $file — 章节编号不连续"
    NUM_GAP_WARN=$((NUM_GAP_WARN + 1))
  fi
done < <(find kb -name "*.md" -print0 2>/dev/null)

if [ "$NUM_GAP_WARN" -eq 0 ]; then
  echo "  ✓ 所有 ## N. 编号连续无跳号"
fi
echo "  结果: $NUM_GAP_WARN 个编号不连续"

# ── 检查 14: anchor 存活检查 ──
echo ""
echo "[14/15] anchor 存活检查..."
ANCHOR_OUT=$(node scripts/check-anchors.js 2>&1)
echo "$ANCHOR_OUT"
# pipefail + grep -c 无匹配会让 || echo "0" 与 grep stdout "0\n" 拼成 "0\n0"，
# 再喂 $((...)) 算术表达式会 syntax error。用 awk END 取最后一行兜底。
ANCHOR_WARN=$(echo "$ANCHOR_OUT" | grep -c "anchor 不存在" 2>/dev/null | awk 'END {print $1+0}')

# ── 检查 15: 内容具象度（A4） ──
echo ""
echo "[15/15] 内容具象度（mermaid / 代码块 / 表格 ≥1）..."
CONTENT_OUT=$(bash scripts/check-content-quality.sh 2>&1)
echo "$CONTENT_OUT"
CONTENT_WARN=$(echo "$CONTENT_OUT" | grep -c "缺少 mermaid" 2>/dev/null | awk 'END {print $1+0}')

# ── 汇总 ──
# Defensive: bash 3.2 + pipefail 在 grep -c 无匹配时可能让 *_WARN 整体赋值失败
# 用 :-0 兜底确保所有变量都有值，避免 set -u 触发 unbound variable
WARN=${WARN:-0}
LINK_WARN=${LINK_WARN:-0}
CASE_WARN=${CASE_WARN:-0}
LINE_WARN=${LINE_WARN:-0}
MEM_WARN=${MEM_WARN:-0}
DEPS_ISSUES=${DEPS_ISSUES:-0}
UNREF_COUNT=${UNREF_COUNT:-0}
DOC_REF_FAIL=${DOC_REF_FAIL:-0}
ID_CONTRACT_FAIL=${ID_CONTRACT_FAIL:-0}
NUM_GAP_WARN=${NUM_GAP_WARN:-0}
ANCHOR_WARN=${ANCHOR_WARN:-0}
CONTENT_WARN=${CONTENT_WARN:-0}
ALL_WARN=$((WARN + LINK_WARN + CASE_WARN + LINE_WARN + MEM_WARN + DEPS_ISSUES + UNREF_COUNT + DOC_REF_FAIL + ID_CONTRACT_FAIL + NUM_GAP_WARN + ANCHOR_WARN + CONTENT_WARN))
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
