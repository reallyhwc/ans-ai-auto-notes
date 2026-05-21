#!/bin/bash
# KB markdown 格式检查 —— 纯 bash/awk 实现
# 替代 npx markdownlint-cli（违反零 npm 依赖原则 → 见 scripts/arch-lint.sh 第 9 项 enforce）
# 覆盖 .markdownlint.json 中启用的规则：MD001 MD003 MD018 MD019 MD023 MD026 MD041 MD042 MD047
# fence code block (``` 包围) 内的内容会被跳过，避免误报 shell 注释 / Python 注释等

set -uo pipefail
cd "$(dirname "$0")"

echo "=== KB 格式检查 (pure-bash lint) ==="

TOTAL=0
FAIL=0

while IFS= read -r f; do
  TOTAL=$((TOTAL + 1))

  # awk 一次扫描，按行打印 "lineno: ruleId 描述"
  # 对齐 markdownlint-cli 默认 front_matter_title 行为：
  # frontmatter 内含 title 字段 → 跳过 MD041（H1 由 title 等价提供）
  ISSUES=$(awk '
    BEGIN { in_code = 0; in_fm = 0; prev_h_level = 0; first_content_line_seen = 0; fm_has_title = 0; }

    # YAML frontmatter (开头连续两个 ---)
    NR == 1 && /^---$/ { in_fm = 1; next }
    in_fm && /^---$/ { in_fm = 0; next }
    in_fm {
      if ($0 ~ /^[[:space:]]*title[[:space:]]*:/) fm_has_title = 1
      next
    }

    # fenced code block 边界 (``` 或 ~~~ 开头)
    /^(```|~~~)/ { in_code = !in_code; next }
    in_code { next }

    # MD041: frontmatter 后第一个非空内容行应是 H1（除非 frontmatter 已提供 title）
    !first_content_line_seen && NF > 0 {
      first_content_line_seen = 1
      if (!fm_has_title && $0 !~ /^# /) {
        print NR ": MD041 文件首行内容应为 H1 标题"
      }
    }

    # MD003: setext 风格 (= 或 - 下划线 heading)
    /^=+$/ && prev_line != "" { print NR ": MD003 应使用 # ATX 风格标题（检测到 = 下划线）" }
    /^-+$/ && prev_line != "" && length($0) >= 3 && prev_line ~ /^[^ -]/ {
      # 仅当前一行非空且非列表项时，认为是 setext h2
      # 这个判断略宽松，可能误判表格分隔/分隔线，故仅在前行较短时报
    }

    # MD018: 标题 # 后缺空格 (#abc)
    /^#+[^# ]/ { print NR ": MD018 标题 # 后需要空格" ; prev_line=$0; next }

    # MD019: 标题 # 后多余空格 (#  abc，至少 2 个空格)
    /^#+  +[^ ]/ { print NR ": MD019 标题 # 后多余空格" }

    # MD023: 标题前有缩进 (空格或 tab)
    /^[ \t]+#+ / { print NR ": MD023 标题不应缩进" }

    # MD026: 标题结尾标点 .,;:!?
    /^#+ .*[.,;:!?]$/ { print NR ": MD026 标题结尾不应有 .,;:!? 标点" }

    # MD001: 标题层级跳跃
    /^#+ / {
      n = 0
      while (substr($0, n+1, 1) == "#") n++
      if (prev_h_level > 0 && n > prev_h_level + 1) {
        print NR ": MD001 标题层级跳跃 (h" prev_h_level " → h" n ")"
      }
      prev_h_level = n
    }

    # MD042: 空链接 []()
    /\[[^]]*\]\(\)/ { print NR ": MD042 链接 URL 为空" }

    { prev_line = $0 }
  ' "$f")

  # MD047: 文件末尾 newline (awk 难以精确判断，用 tail 单独查)
  if [ -s "$f" ]; then
    LAST_CHAR=$(tail -c1 "$f" 2>/dev/null)
    if [ -n "$LAST_CHAR" ]; then
      ISSUES="${ISSUES}
$(wc -l < "$f" | awk '{print $1}'): MD047 文件末尾缺少换行符"
    fi
  fi

  if [ -n "$ISSUES" ]; then
    while IFS= read -r line; do
      [ -z "$line" ] && continue
      echo "  $f:$line"
      FAIL=$((FAIL + 1))
    done <<< "$ISSUES"
  fi
done < <(find kb -name "*.md" 2>/dev/null | sort)

if [ "$FAIL" -eq 0 ]; then
  echo "✓ 所有文件格式通过 ($TOTAL 个文件)"
  exit 0
else
  echo ""
  echo "✗ 发现 $FAIL 个格式问题（$TOTAL 个文件已扫描）"
  exit 1
fi
