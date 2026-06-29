---
name: arch-lint-fix-guide
description: Use when arch-lint.sh outputs warnings or errors. Covers fixes for all 15 checks (frontmatter, dead links, line count, chapter numbering, anchor validation, etc.). Auto-triggered by preflight.sh output.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Edit
---

# Arch-Lint Fix Guide (ANS AI Auto Notes 项目)

## 触发条件

**MUST invoke when**:
- `scripts/preflight.sh` 输出 arch-lint 警告或错误
- 手动跑 `bash scripts/arch-lint.sh` 发现问题
- 修复 kb/ 文件的架构合规性问题

## 15 项检查的修复指南

### 1. Frontmatter 完整性（title + description）

**问题**：`kb/**/*.md` 文件缺少 frontmatter 的 `title` 或 `description` 字段。

**修复**：在文件顶部加 YAML frontmatter：

```markdown
---
title: "文件标题（与文件名一致）"
description: "一句话描述文件内容"
---
```

**注意**：title 必须与中文文件名一致（CLAUDE.md 规则）。

### 2. 元信息头规范（最后整理日期 + 来源）

**问题**：frontmatter 后缺少 `> 最后整理: YYYY-MM-DD | 来源: xxx`。

**修复**：在 frontmatter `---` 后紧跟：

```markdown
> 最后整理: 2026-06-29 | 来源: 极客时间课程 / 官方文档 / 实战总结
```

### 3. 交叉链接有效性（死链检测）

**问题**：`[[./xxx]]` 或 `> 关联: ./xxx` 指向不存在的文件。

**修复**：
1. 检查目标文件是否存在：`ls kb/xxx.md`
2. 如果存在但路径错：修正相对路径
3. 如果文件已删除：移除死链或改为指向新文件

**坑**：中文文件名在链接中可能需要 URL encode（如 `Agent%20Teams`）。

### 4. 重复标题检查

**问题**：多个文件的 `title:` 字段完全相同。

**修复**：
- 如果内容应合并：合并到一个文件
- 如果内容不同：改 title 使其唯一

### 5. CLAUDE.md 目录结构与磁盘一致性

**问题**：CLAUDE.md 中描述的目录结构与实际 `kb/` 目录不符。

**修复**：
- 如果是新增了分类：更新 CLAUDE.md 的"知识库结构"段
- 如果是 CLAUDE.md 过时：同步当前结构

### 6. 链接路径大小写一致性

**问题**：链接中的路径大小写与磁盘实际文件名不一致（Linux 下会 404）。

**修复**：
```bash
# 找到大小写不一致的链接
bash scripts/arch-lint.sh 2>&1 | grep "大小写"
# 手动修正链接，使其与磁盘文件名完全一致
```

### 7. 文件行数超标

**问题**：文件 >1000 行（警告）或 >1500 行（错误）。

**修复**：
- **>1000 行**：关注，考虑拆分
- **>1500 行**：必须拆分。按主题拆成多个文件，互相留 `> 关联:` 链接

拆分时：
1. 识别可独立的子主题
2. 拆出新文件（带完整 frontmatter）
3. 原文件加 `> 关联: ./新文件`
4. 新文件加 `> 关联: ./原文件`

### 8. Memory 文件 frontmatter 格式

**问题**：`memory/*.md` 文件的 frontmatter 缺少 `name`、`description` 或 `type` 字段。

**修复**：

```yaml
---
name: memory-file-slug
description: 一句话描述这个记忆的内容
type: user | feedback | project | reference
---
```

### 9. 零 npm 依赖 enforce

**问题**：项目中出现了 `package.json` 或 `node_modules`。

**修复**：
- 移除 `package.json` 和 `node_modules`
- 改用 Node 内置模块或 vendoring（`scripts/vendor/` 目录）

### 10. 脚本被引用一致性

**问题**：`scripts/*.sh` 文件存在但没被任何入口脚本引用。

**修复**：
- 如果脚本有用：在 `preflight.sh` / `exit-check.sh` / `serve.sh` 中引用
- 如果脚本废弃：删除

### 11. 文档 → 代码引用一致性

**问题**：CLAUDE.md 或 README.md 中引用的脚本/文件不存在。

**修复**：
- 修正引用路径
- 或删除过时的引用

### 12. 标题 ID 生成契约

**问题**：`lib.js` 的 `buildToc` 和 `app.js` 的 heading renderer 使用了不同的 ID 生成逻辑。

**修复**：这是代码 bug，需要修 `scripts/lib.js` 或 `scripts/app.js`，确保两者都用 `stripInline` + `slugify`。

### 13. 章节编号连续性

**问题**：`## N.` 格式的章节编号有跳号（如 §1, §2, §4 缺 §3）。

**修复**：
```bash
# 找到跳号的文件
bash scripts/arch-lint.sh 2>&1 | grep "跳号"
# 手动重新编号，确保连续
```

### 14. Anchor 存活检查

**问题**：`#anchor-link` 指向的 heading 不存在。

**修复**：
- 修正 anchor 拼写
- 或删除指向不存在 heading 的链接

### 15. 内容具象度

**问题**：文件缺少 mermaid 图、代码块、表格中的任何一种具象元素。

**修复**：
- 加一个 mermaid 流程图（优先）
- 或加一个代码示例
- 或加一个对比表格

## 快速查表

| 检查项 | 常见问题 | 修复命令/动作 |
|--------|---------|--------------|
| Frontmatter | 缺 title/description | 编辑文件顶部 |
| 元信息头 | 缺"最后整理" | 加 `> 最后整理: YYYY-MM-DD` |
| 死链 | 目标文件不存在 | `ls` 验证 + 修正路径 |
| 重复标题 | title 字段相同 | 改 title 或合并文件 |
| 行数超标 | >1000 行 | 按主题拆分 |
| 章节跳号 | `## N.` 不连续 | 重新编号 |
| 缺具象度 | 无图/代码/表格 | 加 mermaid 或代码块 |

## 关联文件

- `scripts/arch-lint.sh` — 检查逻辑源码
- `scripts/preflight.sh` — 调用 arch-lint 的入口
- `.claude/skills/kb-content-style/SKILL.md` — 笔记风格规范
