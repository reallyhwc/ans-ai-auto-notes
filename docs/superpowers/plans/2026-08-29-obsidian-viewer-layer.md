# Obsidian 叠加层迁移（浏览/手工编辑层）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> 状态: 提案待 review（2026-08-29 起草，未开始执行；用户 review 后更新状态）

**Goal:** 在不动「AI 自动沉淀 + git/hooks」架构的前提下，把 Obsidian 作为本地浏览/手工编辑层叠加到现有 markdown 知识库，并确保个人/公司双机配置一致。

**Architecture:**
1. **Obsidian 只做视图层**：存储层保持纯 markdown + frontmatter 不变；AI 自动沉淀、hooks、build-index、overview.html、git 规则全部原样保留。Obsidian 与 web 预览是两条互补浏览路径，不做二选一。
2. **`.obsidian/` 分两类**：共享配置（`app.json` / `appearance.json` / `core-plugins.json`）入库；本地状态（`workspace.json` / `cache` 等）gitignore。双机行为一致、窗口布局各自独立。
3. **链接格式锁定 markdown 相对链接**（`useMarkdownLinks: true` + `newLinkFormat: relative`），与现有 370 个 markdown 链接风格一致；**不做 wikilink 迁移**（会破坏 build-index / overview 的解析）。

**Tech Stack:** Obsidian 桌面版 1.13.7（brew cask 已装）、YAML frontmatter、现有 bash/node 工具链

**Spec:** 本方案由 2026-08-29 对话的兼容性分析推导（L0/L1/L2 三层次评估，选定 L1「叠加层」）。决策论证见 §「背景与决策」。

---

## 背景与决策

### 为什么是「叠加」而不是「迁移」

- 存量 76 篇笔记已是纯 markdown + frontmatter（`title`/`description`），Obsidian 原生识别为 Properties
- 链接体系实测：**370 个 markdown 链接 + 29 个 wikilink + 4 个锚点**，Obsidian 全部可渲染、可跳转、可进 graph
- 全库 mermaid + 代码块 + 表格（lint 强制），Obsidian 原生渲染
- 中文/空格文件名 61 个，Obsidian 原生支持

### 三层次评估

| 层次 | 内容 | 改动量 | 结论 |
|---|---|---|---|
| L0 下载看看 | 打开 vault 即可 | ≈0 | 仅需 .gitignore 先行 |
| **L1 叠加层（选定）** | 共享配置入库 + 本地状态忽略 + 使用指南 | 小 | **本方案执行范围** |
| L2 完全原生化 | 370 链接改 wikilink、dataview 替代 INDEX、废弃 overview | 大 | 拒绝：废掉 build-index/overview 工具链 |

### Global Constraints

- **不改 kb/ 存量笔记**（纯叠加，76 篇一字不动）
- **不写 INDEX.md / manifest.json / overview.html / timeline.json**（构建产物与 web 层，Obsidian 不得触碰）
- **链接格式保持 markdown 相对链接**，禁止 wikilink 迁移
- `.obsidian/` 仅 3 个共享配置入库，其余全部忽略
- 双机（个人 xuhu / 公司 reallyhwc）行为一致，各自窗口布局独立
- 完成后追加 ADR-005 记录决策

## File Structure

### 修改的文件

| 文件 | 责任 | 改动类型 |
|---|---|---|
| `.gitignore` | 新增 Obsidian ignore 规则（仅白名单 3 个共享配置） | 修改 |
| `.obsidian/app.json` | 链接格式（markdown + relative）等共享设置 | 新增 |
| `.obsidian/appearance.json` | 共享外观（主题/字号） | 新增 |
| `.obsidian/core-plugins.json` | 最小核心插件集 | 新增 |
| `docs/obsidian-guide.md` | 双机使用指南（打开 vault / 注意事项 / 排障） | 新增 |
| `docs/decisions.md` | 追加 ADR-005 | 修改 |

### 不修改的文件

- `kb/` 全部 76 篇笔记
- `INDEX.md`、`manifest.json`、`overview.html`、`timeline.json`
- `scripts/`、`tests/`、`.claude/`、`CLAUDE.md`、`exit-check.sh`

---

## Task 1: .gitignore 增加 Obsidian 规则（必须先于打开 vault）

**Files:**
- Modify: `.gitignore`
- Test: `git check-ignore`

- [ ] **Step 1: 追加 Obsidian ignore 规则**

在 `.gitignore` 末尾追加：

```gitignore
# Obsidian vault（仅共享 3 个配置文件入库，其余本地状态/缓存全部忽略）
.obsidian/*
!.obsidian/app.json
!.obsidian/appearance.json
!.obsidian/core-plugins.json
```

- [ ] **Step 2: 验证 ignore 规则生效**

```bash
git check-ignore .obsidian/workspace.json .obsidian/cache
# 预期：两个路径都被列出（被忽略）
git status --short
# 预期：clean（无新增未跟踪文件）
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore(gitignore): 忽略 Obsidian 本地状态，白名单 3 个共享配置"
```

## Task 2: 新建共享 Obsidian 配置（3 个文件）

**Files:**
- Create: `.obsidian/app.json`
- Create: `.obsidian/appearance.json`
- Create: `.obsidian/core-plugins.json`

**Interfaces:**
- 这 3 个文件是唯一入库的 `.obsidian/` 内容（与 Task 1 的 gitignore 白名单一一对应）

- [ ] **Step 1: 创建 `.obsidian/app.json`（锁定链接格式）**

```json
{
  "useMarkdownLinks": true,
  "newLinkFormat": "relative",
  "alwaysUpdateLinks": true,
  "showLineNumber": true,
  "readableLineLength": true
}
```

- [ ] **Step 2: 创建 `.obsidian/appearance.json`（共享外观）**

```json
{
  "theme": "system",
  "cssTheme": "",
  "baseFontSize": 16,
  "enabledCssSnippets": []
}
```

- [ ] **Step 3: 创建 `.obsidian/core-plugins.json`（最小核心插件集）**

```json
{
  "file-explorer": true,
  "global-search": true,
  "switcher": true,
  "graph": true,
  "backlink": true,
  "outgoing-link": true,
  "tag-pane": true,
  "page-preview": true,
  "templates": false,
  "file-recovery": true
}
```

> ⚠️ 若当前 Obsidian 版本对 `core-plugins.json` 使用数组格式（旧版）或字段不同，以 Obsidian 首次生成的文件为准覆盖本文件——本任务的核心约束是 **app.json 的链接格式三项**，其余可随版本调整。

- [ ] **Step 4: 验证仅 3 个文件被跟踪**

```bash
git status --short
# 预期：仅 .obsidian/app.json、appearance.json、core-plugins.json 三个新增
git check-ignore .obsidian/workspace.json
# 预期：workspace.json 仍被忽略
```

- [ ] **Step 5: Commit**

```bash
git add .obsidian/app.json .obsidian/appearance.json .obsidian/core-plugins.json
git commit -m "feat(obsidian): 共享 vault 配置——markdown 相对链接 + 最小核心插件"
```

## Task 3: 双机使用指南（docs/obsidian-guide.md）

**Files:**
- Create: `docs/obsidian-guide.md`

- [ ] **Step 1: 创建指南文件**（内容见下方完整正文）

指南正文（写入 `docs/obsidian-guide.md`）：

```markdown
# Obsidian 叠加层使用指南

> 个人电脑（/Users/xuhu）与公司电脑（/Users/reallyhwc）通用。

## 打开 vault

1. 本仓库已 clone 并 `git pull` 到最新
2. Obsidian → Open folder as vault → 选择本仓库根目录
3. 首次打开会自动生成 `.obsidian/` 本地状态（已 gitignore，不入库）

## 已共享 vs 本地

| 内容 | 位置 | 是否入库 |
|---|---|---|
| 链接格式 / 外观 / 核心插件 | `.obsidian/app.json` 等 3 文件 | ✅ 入库，双机一致 |
| 窗口布局 / 缓存 / 社区插件 | `.obsidian/workspace.json` 等 | ❌ 忽略，各自独立 |

## 与自动化架构的关系

- **kb/ 笔记**：AI 自动沉淀（对话中直接写入）与你手工编辑（Obsidian）两路都写同一批文件
- **构建产物**：`INDEX.md` / `manifest.json` / `overview.html` 是 build-index 生成的，**不要手改**（pretool-guard 也会拦）
- **质量检查**：你在 Obsidian 里改的笔记，下次 SessionStart 会被 arch-lint（15 项）自动检查

## 注意事项

- 链接格式已锁定 markdown 相对链接：在 Obsidian 里新建链接保持 `[text](相对路径.md)` 风格，**不要**用 `[[wikilink]]`
- 移动/重命名 kb/ 文件后需跑 `node scripts/build-index.js` 重建索引
- 若 SessionStart 预检报「遗留变更」：先 `git status` 看是否有未提交的 Obsidian 本地状态文件，加入 .gitignore 或提交

## 排障

- **链接点了打不开**：检查路径是否含 `%20`（Obsidian 能处理）；确认文件在 kb/ 下且未改文件名
- **graph 没有连线**：确认 `app.json` 的 `useMarkdownLinks` 为 true（markdown 链接也计入 graph）
```

- [ ] **Step 2: Commit**

```bash
git add docs/obsidian-guide.md
git commit -m "docs(obsidian): 双机使用指南——打开 vault、共享/本地边界、注意事项"
```

## Task 4: 打开 vault 验收（人工 + 机械验证）

**Files:**
- 无文件改动，纯验证

- [ ] **Step 1: 打开 vault 并做渲染验收清单**

```bash
open -a Obsidian   # 或 obsidian 打开仓库目录
```

人工核对（验收清单）：
- [ ] 76 篇笔记全部列出、可打开
- [ ] frontmatter 显示为 Properties（title/description）
- [ ] mermaid 图正常渲染（DSH 笔记 §0/§2/§3 有图）
- [ ] markdown 链接可点击跳转（含中文文件名路径）
- [ ] 4 个锚点链接可跳转（`#` 锚点）；若个别失效仅降级为打开文件，可接受
- [ ] Graph 视图能看到文件间连线
- [ ] `git status` 干净：Obsidian 打开后**不产生**任何未跟踪文件（验证 Task 1 的 ignore 生效）

- [ ] **Step 2: 验证自动化不受影响**

```bash
bash scripts/arch-lint.sh   # 预期 0 错误
node scripts/build-index.js # 预期 INDEX 条目 = kb 文件数，无 diff
git status --short          # 预期 clean
```

- [ ] **Step 3: 修复发现的问题**（若有渲染异常）

回到对应 Task 修正配置或忽略规则，重复验证。

## Task 5: 追加 ADR-005 记录决策（review 通过后执行）

**Files:**
- Modify: `docs/decisions.md`

- [ ] **Step 1: 在 docs/decisions.md 末尾追加 ADR-005**

```markdown
## ADR-005: Obsidian 作为叠加层（浏览/手工编辑），非存储迁移

- **日期**: 2026-08-29
- **状态**: 提案待 review（通过后改「接受」）
- **背景**: 知识库已 76 篇纯 markdown 笔记；用户希望在个人/公司双机用 Obsidian 浏览编辑，同时保留 AI 自动沉淀架构
- **选项**:
  - (a) L0 仅浏览（只加 .gitignore）
  - (b) L1 叠加层：共享配置入库 + 本地状态忽略 + 使用指南（选定）
  - (c) L2 完全原生化：wikilink 迁移、dataview 替代 INDEX、废弃 overview.html
- **决定**: (b)
- **理由**:
  - 存储层已是 Obsidian 友好的 markdown + frontmatter，无需迁移
  - L2 会破坏 build-index/overview 工具链，收益仅是 graph 增强
  - 叠加层让「AI 写 + git/hooks 管」与「Obsidian 看/手工改」互补共存
```

- [ ] **Step 2: Commit**

```bash
git add docs/decisions.md
git commit -m "docs(adr): ADR-005 Obsidian 叠加层决策"
```

---

## 验收标准（全部满足才算完成）

1. `git status` clean，Obsidian 打开/使用不产生未跟踪文件
2. 双机（个人/公司）打开 vault 后行为一致（链接格式、外观、核心插件）
3. 存量 76 篇笔记可渲染、可跳转、graph 有连线
4. arch-lint 15 项 0 错误；build-index 无 diff
5. kb/ 存量内容一字未动；INDEX.md / manifest.json / overview.html 未被 Obsidian 写入
