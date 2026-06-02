---
status: completed
completedDate: 2026-06-02
---

# G5 执行后审计发现（待集成阶段处理）

> 创建于: 2026-06-02
> 来源: G5 执行后深度自审，发现 plan 本身的设计缺陷与测试缺口
> 处理时机: Task 18 集成阶段（5 worktree rebase + merge 时统一修）
> 关联: [2026-06-01-kb-system-uplift-plan.md](./2026-06-01-kb-system-uplift-plan.md) Task 16

执行 G5 时严格未偏离 plan，但深度自审后识别出以下 plan 设计缺陷与测试缺口，需要在集成阶段统一处理。

---

## 一、真问题（plan 本身的设计缺陷）

### 🔴 #1 split-doc 拆分会丢失 h1 标题和 lead text

**位置**: `scripts/split-doc.js` `parseH2Sections`（line 27-56）

**问题**: `parseH2Sections` 只识别 `##`，h1 行（如 `# Big`）和它之前/之间的内容（如 frontmatter 后的 lead 段落）会被静默丢弃——不属于任何 section，也不会写回原文件。

**复现**:
```
原文件:
---
fm
---

# Big          ← 这一行拆分后消失

## 章节 A
...

拆分后原文件:
---
fm
---

> 已拆分到：...

## 章节 C
...
```

**测试漏洞**: `tests/split-doc.test.js` 没断言 `# Big` 是否保留，所以测试通过但 bug 存在。

**修复方向**: parseH2Sections 应保留首个 `##` 之前的 lead text（含 h1）作为 `prologue`，splitDocBySections 写回时拼回。

---

### 🔴 #2 拆分不重编号，违反 CLAUDE.md `## N.` 章节连续性规则

**位置**: `scripts/split-doc.js` `splitDocBySections`（line 58-103）

**问题**: CLAUDE.md 第 88 行硬规：
> 内容拆分后若带走中间某个编号，剩余章节需重新编号。此项由 `arch-lint.sh [13/13]` 自动检查。

但 split-doc 只删除指定章节，不重编号。用户对 `## 1. ## 2. ## 3.` 的文件拆走 `## 2.` 后，剩 `## 1. ## 3.` 跳号，触发 arch-lint [13/14] 失败（编号现在是 [13/14] 因为 B3 新增了 [14/14]）。

**修复方向**: 检测剩余章节是否为 `## N.` 样式，是则自动重编号；或至少在终端 warn 用户手工处理。

---

### 🔴 #3 frontmatter title 与 fname 可能不一致

**位置**: `scripts/split-doc.js` line 84-89

```js
const fname = sanitizeFilename(t) + '.md';   // 'A:B' → 'A：B.md'
const newFm = '---\ntitle: "' + t + '"...';   // title 还是原始 'A:B'
```

**问题**: 违反 CLAUDE.md「中文文件名（强制性）」规则——磁盘文件名必须与 frontmatter `title` 一致。

**修复方向**:
```js
const safeName = sanitizeFilename(t);
const fname = safeName + '.md';
const newFm = `---\ntitle: "${safeName}"...`;
```
两边同步用 sanitize 后的名字。

---

### 🟡 #4 title 含双引号会破坏 YAML frontmatter

**位置**: `scripts/split-doc.js` line 89

```js
'\ntitle: "' + t + '"\n'
```

若 `t = '论"X"的本质'`，输出 `title: "论"X"的本质"` 是非法 YAML。低概率，但是雷。

**修复方向**: title 用 YAML 单引号（更宽松），或转义双引号：`t.replace(/"/g, '\\"')`。

---

## 二、测试覆盖不足

`tests/split-doc.test.js` 当前只有 3 个 case，应补：

| 缺失场景 | 暴露 bug | 优先级 |
|---------|---------|--------|
| frontmatter 是否完整保留 | — | 中 |
| 拆出新文件内容（含 frontmatter + h1 + body）正确 | — | 中 |
| 原文件 h1 / lead text 保留 | #1 | **高** |
| code block 内的 `## fake` 不被误识别为章节 | — | 低（实现有 `inCode` 防护，但无测） |
| 重复调用时 "输出文件已存在" 抛错路径 | — | 低 |
| `## N.` 样式文件拆分后剩余编号不跳号 | #2 | **高** |
| sanitizeFilename 后 frontmatter title 与 fname 一致 | #3 | 中 |

---

## 三、一致性小问题

### 🟡 #5 CLAUDE.md 测试文件组织段未更新

**位置**: `CLAUDE.md` 第 159-164 行的 tests/ 树状示例：
```
tests/
├── lib.test.js
├── link-renderer.test.js
├── build-index.test.js
└── integration.test.js
```

实际 tests/ 目录已有 server.test.js / search.test.js 等不在列，是 pre-existing 历史包袱。G5 加 split-doc.test.js 后偏差更大。集成阶段顺手补一笔。

---

## 集成阶段建议处理顺序

1. **先修 #1 + #3 + 高优测试**：影响"半自动拆分工具能否实际可用"——split-doc 当前用于真实大文件会丢内容/产生不一致文件名
2. **#2 与 arch-lint [13/14] 联动**：拆分后跑 arch-lint 验证编号
3. **#4 + #5**：小修补
4. **跑全套验证**: `bash test.sh && bash scripts/arch-lint.sh`

---

## 我已正确处理的（无需再动）

- ✅ INDEX.md drift（worktree base 大小写差异）已 discard，未污染 commit
- ✅ Plan 内 sanitizeFilename 测试/实现矛盾已 STOP 报告，按用户决定（修测试 input）处理
- ✅ baseline 对比：73/73 tests, arch-lint 0 错误（6 警告同 baseline，非本次引入）
- ✅ Conventional Commits 规范、ADR 插入位置精确
- ✅ docs/ 不在 build-index 扫描范围，无需更新 INDEX.md
