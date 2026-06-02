---
status: completed
completedDate: 2026-06-02
---

# KB 系统升级 13 项 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 通过 5 个并行 worktree 完成 KB 系统的 13 项升级（数据索引层 / Hook&Lint / 规则结构化 / 跨设备协作 / 编辑器辅助），每组完成后串行 rebase 集成到 main。

**Architecture:** Master plan 内分 5 组（G1~G5），组间几乎无文件冲突，可并行 worktree 推进；组内 task 串行。每个新 lint 检查、新脚本必须配单元测试（TDD）。集成顺序 G1→G2→G3→G4→G5。

**Tech Stack:** Node.js（零 npm 依赖，仅内置模块）、bash（hook 脚本）、markdown、mermaid、git worktree。

---

## File Structure

| 路径 | 操作 | 责任 | 组 |
|---|---|---|---|
| `scripts/lib.js` | 修改 | export `stripInline` 顶层化 | G1 |
| `tests/lib.test.js` | 修改 | 加 stripInline 单测 | G1 |
| `scripts/build-timeline.js` | 新建 | 从 git log 聚合周时间线 | G1 |
| `tests/build-timeline.test.js` | 新建 | timeline 聚合单测 | G1 |
| `timeline.json` | git rm + .gitignore | 改为构建产物 | G1 |
| `.gitignore` | 修改 | 加 `timeline.json` | G1 |
| `scripts/build-index.js` | 修改 | 加 searchIndex + backlinks 字段 | G1 |
| `tests/search.test.js` | 新建 | 全文搜索索引测试 | G1 |
| `tests/backlinks.test.js` | 新建 | 反向链接图测试 | G1 |
| `overview.html` | 修改 | 加搜索框 | G1 |
| `scripts/app.js` | 修改 | 实时搜索 filter + 反向链接渲染 | G1 |
| `scripts/check-anchors.js` | 新建 | anchor 存活检查 | G1 |
| `tests/anchor-check.test.js` | 新建 | anchor 检查单测 | G1 |
| `scripts/arch-lint.sh` | 修改 | 加 [14/14] anchor + [15/15] 内容质量 | G1+G2 |
| `scripts/session-log.sh` | 修改 | 改触发条件为 commit 增量 | G2 |
| `.claude/session-logs/.last-checkpoint` | 新建（runtime） | 记录上次 log 时的 HEAD SHA | G2 |
| `tests/session-log.test.js` | 新建 | 触发逻辑单测 | G2 |
| `tests/content-quality.test.js` | 新建 | 内容质量 lint 单测 | G2 |
| `scripts/verify-claim.sh` | 新建 | PostToolUse 沉淀验证 | G2 |
| `.claude/settings.local.json` | 修改 | 加 PostToolUse hook 配置 | G2+G4 |
| `.claude/claim-ledger.log` | 新建（runtime） | 沉淀声明审计日志 | G2 |
| `exit-check.sh` | 修改 | [5/7] 改触发 + 加 [8/8] + [9/9] | G2+G4 |
| `.claude/skills/auto-commit-discipline/SKILL.md` | 新建 | Git 规则 skill | G3 |
| `.claude/skills/kb-content-style/SKILL.md` | 新建 | 笔记风格 skill | G3 |
| `.claude/skills/kb-tdd-discipline/SKILL.md` | 新建 | 测试纪律 skill | G3 |
| `CLAUDE.md` | 修改 | 缩减为索引 + 加 plan/ADR 段 | G3+G4+G5 |
| `scripts/sync-memory.sh` | 新建 | 双向 memory sync | G4 |
| `.claude/memory-snapshot/` | 新建（目录） | memory snapshot 入 git | G4 |
| `.claude/memory-snapshot/.allowlist` | 新建 | 同步白名单 | G4 |
| `tests/sync-memory.test.js` | 新建 | sync 单测 | G4 |
| `tests/plans-status.test.js` | 新建 | plans 状态解析单测 | G4 |
| `bootstrap.sh` | 新建 | 新设备一键 onboarding | G4 |
| `SETUP.md` | 新建 | 人类可读 setup 文档 | G4 |
| `scripts/split-doc.js` | 新建 | 半自动拆分助手 | G5 |
| `tests/split-doc.test.js` | 新建 | 拆分助手单测 | G5 |
| `docs/decisions.md` | 新建 | ADR 决策先例 | G5 |

---

## Execution Strategy

**Worktree 命名约定**（用 `using-git-worktrees` skill 创建）：
- `kb-uplift-g1-data` — G1 数据索引层
- `kb-uplift-g2-hook` — G2 Hook/Lint 增强
- `kb-uplift-g3-skills` — G3 规则结构化
- `kb-uplift-g4-sync` — G4 跨设备/协作
- `kb-uplift-g5-tools` — G5 编辑器辅助

**并行**：5 组在不同 worktree 同时推进。
**集成**：完成后按 G1→G2→G3→G4→G5 顺序 rebase 到 main + 解决冲突 + merge。冲突文件主要是 `scripts/arch-lint.sh`、`CLAUDE.md`、`.claude/settings.local.json`、`exit-check.sh`，且改动通常在文件不同位置，rebase 时简单合并。

**每组 worktree 开第一个 task 前**：执行者按 `using-git-worktrees` skill 创建 worktree，cd 进去，再开始 Task。

---

## Group G1: 数据索引层（worktree: `kb-uplift-g1-data`）

### Task 1: 重构 lib.js 导出 stripInline（G1.0 前置）

**Files:**
- Modify: `scripts/lib.js:39-57` (buildToc) + `scripts/lib.js:165-173` (module.exports)
- Modify: `tests/lib.test.js`

- [ ] **Step 1: 先写失败测试**

在 `tests/lib.test.js` 顶部 require 列表加 `stripInline`：

```javascript
const {
  escapeHtml,
  escapeAttr,
  slugify,
  buildToc,
  resolveRelativeMd,
  stripInline,
} = require('../scripts/lib.js');
```

在文件末尾追加：

```javascript
// ── stripInline ────────────────────────────────────────────
test('stripInline: 去掉 backtick 包围的内联代码', () => {
  assert.equal(stripInline('1. `@Tool` 注解'), '1. @Tool 注解');
});

test('stripInline: 去掉粗体 ** 标记', () => {
  assert.equal(stripInline('**important** text'), 'important text');
});

test('stripInline: 去掉斜体 * 标记', () => {
  assert.equal(stripInline('*emphasis* here'), 'emphasis here');
});

test('stripInline: 混合 backtick + bold + italic', () => {
  assert.equal(stripInline('`code` and **bold** and *italic*'), 'code and bold and italic');
});

test('stripInline: 无 markdown 标记原样返回', () => {
  assert.equal(stripInline('plain text'), 'plain text');
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/lib.test.js`
Expected: 5 个新测试报 `TypeError: stripInline is not a function`

- [ ] **Step 3: 重构 lib.js 把 stripInline 提到 top-level**

修改 `scripts/lib.js`，在 `slugify` 函数（line 34-36）后、`buildToc`（line 39）前插入：

```javascript
// 去掉 markdown 内联标记（backtick / 粗体 / 斜体），与 marked 的 token.text 对齐
function stripInline(str) {
  return String(str)
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1');
}
```

修改 `buildToc` 函数（line 39-57），删除内嵌的 stripInline 定义（line 49-52），让 buildToc 内的代码直接调用 top-level 的 stripInline：

```javascript
function buildToc(markdown) {
  var lines = String(markdown).split('\n');
  var toc = [];
  var inCodeBlock = false;
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (/^```/.test(line)) { inCodeBlock = !inCodeBlock; continue; }
    if (inCodeBlock) continue;
    var h2 = /^##\s(.+)/.exec(line);
    var h3 = /^###\s(.+)/.exec(line);
    if (h2) toc.push({ level: 2, text: h2[1], id: slugify(stripInline(h2[1])) });
    else if (h3) toc.push({ level: 3, text: h3[1], id: slugify(stripInline(h3[1])) });
  }
  return toc;
}
```

修改 `module.exports`（line 165-173），加 `stripInline`：

```javascript
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    escapeHtml,
    escapeAttr,
    slugify,
    stripInline,
    buildToc,
    resolveRelativeMd,
    renderKbLink,
    extractWordCloudData,
  };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `bash test.sh`
Expected: 所有测试通过（含原有 buildToc 测试不应回归）

- [ ] **Step 5: 跑 arch-lint 确认 [12/13] 契约检查仍通过**

Run: `bash scripts/arch-lint.sh 2>&1 | grep "12/13"`
Expected: `✓ 标题 ID 契约一致`

- [ ] **Step 6: Commit**

```bash
git add scripts/lib.js tests/lib.test.js
git commit -m "refactor: 提取 stripInline 为 top-level 函数并 export

为 B3 anchor 存活检查铺路。新增 5 个 stripInline 单测，
buildToc 行为不变（仍调用 top-level stripInline），
arch-lint [12/13] 契约检查仍通过。"
```

---

### Task 2: 实现 timeline 自动化（A2）

**Files:**
- Create: `scripts/build-timeline.js`
- Create: `tests/build-timeline.test.js`
- Modify: `.gitignore`
- Remove from git: `timeline.json`（保留磁盘文件）

- [ ] **Step 1: 写测试 fixture + 失败测试**

新建 `tests/build-timeline.test.js`：

```javascript
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { aggregateByWeek, parseGitLog } = require('../scripts/build-timeline.js');

test('parseGitLog: 解析 git log 格式 (hash|date|subject)', () => {
  const raw = 'abc123|2026-05-28 10:00:00 +0800|docs: 新增 X\n' +
              'def456|2026-05-29 11:00:00 +0800|fix: 修复 Y\n';
  const commits = parseGitLog(raw);
  assert.equal(commits.length, 2);
  assert.equal(commits[0].hash, 'abc123');
  assert.equal(commits[0].subject, 'docs: 新增 X');
  assert.equal(commits[0].date, '2026-05-28');
});

test('aggregateByWeek: 按 ISO 周聚合 commits', () => {
  const commits = [
    { hash: 'a1', date: '2026-05-25', subject: 'feat: A' },  // W22 Mon
    { hash: 'a2', date: '2026-05-31', subject: 'feat: B' },  // W22 Sun
    { hash: 'a3', date: '2026-06-01', subject: 'feat: C' },  // W23 Mon
  ];
  const weeks = aggregateByWeek(commits);
  assert.equal(weeks.length, 2);
  assert.ok(weeks[0].week.startsWith('2026-W22'));
  assert.equal(weeks[0].entries.length, 2);
  assert.ok(weeks[1].week.startsWith('2026-W23'));
  assert.equal(weeks[1].entries.length, 1);
});

test('aggregateByWeek: entries 含 date + summary（commit subject）', () => {
  const commits = [{ hash: 'a1', date: '2026-05-25', subject: 'docs: X' }];
  const weeks = aggregateByWeek(commits);
  assert.equal(weeks[0].entries[0].date, '2026-05-25');
  assert.equal(weeks[0].entries[0].summary, 'docs: X');
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/build-timeline.test.js`
Expected: `Cannot find module '../scripts/build-timeline.js'`

- [ ] **Step 3: 实现 scripts/build-timeline.js**

新建 `scripts/build-timeline.js`：

```javascript
#!/usr/bin/env node
/**
 * build-timeline.js — 从 git log 聚合周时间线
 *
 * 用法: node scripts/build-timeline.js
 * 输出: timeline.json（构建产物，已加入 .gitignore）
 *
 * 数据流: git log -> commits -> ISO 周聚合 -> timeline.json
 * 设计原则: 零依赖；与历史 timeline.json schema 兼容（weeks[].entries[].summary + links[]）
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TIMELINE_PATH = path.join(ROOT, 'timeline.json');

// 解析 git log --pretty=format:"%h|%ai|%s" 输出
function parseGitLog(raw) {
  return raw.split('\n')
    .filter(l => l.trim())
    .map(line => {
      const parts = line.split('|');
      if (parts.length < 3) return null;
      const hash = parts[0];
      const dateStr = parts[1].split(' ')[0]; // 取日期部分
      const subject = parts.slice(2).join('|');
      return { hash, date: dateStr, subject };
    })
    .filter(Boolean);
}

// ISO 周计算：(year, weekNum) — 周一为一周起始
function isoWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  // 复制并定位到周四（ISO 周以含周四的为准）
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (target.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  target.setUTCDate(target.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const weekNum = 1 + Math.round((target - firstThursday) / (7 * 24 * 3600 * 1000));
  return { year: target.getUTCFullYear(), week: weekNum };
}

// 取该 ISO 周的周一和周日日期（用于显示）
function weekRangeLabel(year, weekNum) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = (jan4.getUTCDay() + 6) % 7;
  const week1Mon = new Date(jan4);
  week1Mon.setUTCDate(jan4.getUTCDate() - jan4Day);
  const mon = new Date(week1Mon);
  mon.setUTCDate(mon.getUTCDate() + (weekNum - 1) * 7);
  const sun = new Date(mon);
  sun.setUTCDate(sun.getUTCDate() + 6);
  const fmt = d => String(d.getUTCMonth() + 1).padStart(2, '0') + '.' + String(d.getUTCDate()).padStart(2, '0');
  const weekStr = String(weekNum).padStart(2, '0');
  return year + '-W' + weekStr + ' (' + fmt(mon) + ' - ' + fmt(sun) + ')';
}

// 按周聚合
function aggregateByWeek(commits) {
  const byWeek = new Map();
  for (const c of commits) {
    const { year, week } = isoWeek(c.date);
    const key = year + '-' + String(week).padStart(2, '0');
    if (!byWeek.has(key)) {
      byWeek.set(key, {
        week: weekRangeLabel(year, week),
        sortKey: key,
        entries: [],
      });
    }
    byWeek.get(key).entries.push({
      date: c.date,
      summary: c.subject,
      links: [],
    });
  }
  // 按 sortKey 倒序（最新周在前）
  return Array.from(byWeek.values())
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey))
    .map(w => { delete w.sortKey; return w; });
}

function main() {
  console.log('[build-timeline] 提取 git log...');
  const raw = execSync(
    'git log --since="6 months ago" --pretty=format:"%h|%ai|%s"',
    { cwd: ROOT, encoding: 'utf-8' }
  );
  const commits = parseGitLog(raw);
  console.log('[build-timeline] 解析 ' + commits.length + ' 个 commit');
  const weeks = aggregateByWeek(commits);
  fs.writeFileSync(TIMELINE_PATH, JSON.stringify(weeks, null, 2) + '\n', 'utf-8');
  console.log('[build-timeline] 已生成 timeline.json (' + weeks.length + ' 周)');
}

if (require.main === module) {
  main();
}

module.exports = { parseGitLog, aggregateByWeek, isoWeek, weekRangeLabel };
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test tests/build-timeline.test.js`
Expected: 3 个测试全 pass

- [ ] **Step 5: 把 timeline.json 改为构建产物**

```bash
echo "timeline.json" >> .gitignore
git rm --cached timeline.json
node scripts/build-timeline.js
```

验证：`git status` 应显示 `.gitignore` 修改 + `timeline.json` 从索引移除。

- [ ] **Step 6: Commit**

```bash
git add scripts/build-timeline.js tests/build-timeline.test.js .gitignore
git commit -m "feat: A2 timeline 自动化（仅 timeline.json）

新增 scripts/build-timeline.js：按 ISO 周聚合 git log -> timeline.json。
timeline.json 改为构建产物（.gitignore），timeline/*.md 保留手维护。
schema 与历史兼容（weeks[].entries[].summary + links[]）。"
```

---

### Task 3: 全文搜索索引生成（A5 part 1）

**Files:**
- Modify: `scripts/build-index.js`
- Create: `tests/search.test.js`

- [ ] **Step 1: 写失败测试**

新建 `tests/search.test.js`：

```javascript
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { tokenize, buildSearchIndex } = require('../scripts/build-index.js');

test('tokenize: 英文按 \\w+ 分词，转小写', () => {
  const tokens = tokenize('Hello World 中文混合 Agent-MCP');
  assert.ok(tokens.includes('hello'));
  assert.ok(tokens.includes('world'));
  assert.ok(tokens.includes('agent'));
  assert.ok(tokens.includes('mcp'));
});

test('tokenize: 中文按字符切（unigram）', () => {
  const tokens = tokenize('知识库');
  assert.ok(tokens.includes('知'));
  assert.ok(tokens.includes('识'));
  assert.ok(tokens.includes('库'));
});

test('tokenize: 去除代码块和 mermaid 块', () => {
  const md = 'hello\n```js\ncode_only_should_be_skipped\n```\nworld';
  const tokens = tokenize(md);
  assert.ok(tokens.includes('hello'));
  assert.ok(tokens.includes('world'));
  assert.ok(!tokens.includes('code_only_should_be_skipped'));
});

test('buildSearchIndex: 倒排表 token -> [fileIdx]', () => {
  const files = [
    { idx: 0, text: 'agent design' },
    { idx: 1, text: 'agent runtime' },
    { idx: 2, text: 'database query' },
  ];
  const idx = buildSearchIndex(files);
  assert.deepEqual(idx['agent'].sort(), [0, 1]);
  assert.deepEqual(idx['design'], [0]);
  assert.deepEqual(idx['database'], [2]);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/search.test.js`
Expected: `tokenize is not a function` / `buildSearchIndex is not a function`

- [ ] **Step 3: 修改 scripts/build-index.js 加分词 + 索引**

在 `scripts/build-index.js` 顶部 require 之后、`parseFrontmatter` 之前加：

```javascript
// ============================================================
// 全文搜索：分词 + 倒排表
// ============================================================

// 中英文混合分词：英文按 \w+，中文按单字（unigram）
function tokenize(text) {
  const tokens = new Set();
  // 去除代码块 ``` ... ``` 内的内容（含 mermaid）
  const stripped = String(text).replace(/```[\s\S]*?```/g, ' ');
  // 英文 token（\w+ 转小写）
  const enMatches = stripped.match(/[a-zA-Z0-9_]+/g) || [];
  enMatches.forEach(t => { if (t.length >= 2) tokens.add(t.toLowerCase()); });
  // 中文单字
  const zhMatches = stripped.match(/[一-鿿]/g) || [];
  zhMatches.forEach(c => tokens.add(c));
  return Array.from(tokens);
}

// 构建倒排表：{token: [fileIdx, ...]}
function buildSearchIndex(files) {
  const idx = {};
  files.forEach(f => {
    const tokens = tokenize(f.text);
    tokens.forEach(t => {
      if (!idx[t]) idx[t] = [];
      if (idx[t][idx[t].length - 1] !== f.idx) idx[t].push(f.idx);
    });
  });
  return idx;
}
```

修改 `main()` 函数，在生成 manifest 前加搜索索引构建。在 `main()` 中 `// 统计` 后、`// 输出 manifest.json` 前插入：

```javascript
  // 构建全文搜索索引（扁平化所有 file，给每个分配 idx）
  const flatFiles = [];
  function collectFiles(node) {
    node.files.forEach(f => {
      const fullPath = path.join(ROOT, f.path);
      let content = '';
      try { content = fs.readFileSync(fullPath, 'utf-8'); } catch (e) { /* skip */ }
      flatFiles.push({
        idx: flatFiles.length,
        path: f.path,
        text: (f.title || '') + ' ' + (f.desc || '') + ' ' + content,
      });
    });
    node.children.forEach(collectFiles);
  }
  categories.forEach(collectFiles);
  const searchIndex = buildSearchIndex(flatFiles);
  const searchFiles = flatFiles.map(f => ({ idx: f.idx, path: f.path }));
```

修改 manifest 输出（约 line 167）：

```javascript
  const manifest = {
    categories: categories,
    searchIndex: searchIndex,
    searchFiles: searchFiles,
  };
```

修改 `module.exports`（最后一行）：

```javascript
module.exports = { parseFrontmatter, scanDir, countFiles, generateIndexMd, tokenize, buildSearchIndex };
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test tests/search.test.js`
Expected: 4 个测试全 pass

- [ ] **Step 5: 跑 build-index 确认 manifest.json 含新字段**

```bash
node scripts/build-index.js
node -e "const m=require('./manifest.json'); console.log('searchIndex tokens:', Object.keys(m.searchIndex).length); console.log('searchFiles:', m.searchFiles.length);"
```
Expected: tokens > 1000, searchFiles = 47

- [ ] **Step 6: Commit**

```bash
git add scripts/build-index.js tests/search.test.js
git commit -m "feat: A5 part 1 全文搜索倒排索引

build-index.js 新增 tokenize + buildSearchIndex，
manifest.json 加 searchIndex / searchFiles 字段。
分词：英文 \\w+ 小写，中文按字符 unigram，跳过代码块。"
```

---

### Task 4: 反向链接 + 前端搜索 UI（A5 part 2）

**Files:**
- Modify: `scripts/build-index.js`
- Create: `tests/backlinks.test.js`
- Modify: `overview.html`
- Modify: `scripts/app.js`

- [ ] **Step 1: 写反向链接失败测试**

新建 `tests/backlinks.test.js`：

```javascript
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { extractLinks, buildBacklinks } = require('../scripts/build-index.js');

test('extractLinks: 提取 ](./x.md) 风格', () => {
  const md = '看 [X](./x.md) 和 [Y](../sub/y.md)';
  const links = extractLinks(md);
  assert.deepEqual(links.sort(), ['../sub/y.md', './x.md'].sort());
});

test('extractLinks: 提取 [[./x.md]] 双中括号风格', () => {
  const md = '关联 [[./other.md]]';
  const links = extractLinks(md);
  assert.deepEqual(links, ['./other.md']);
});

test('extractLinks: 忽略外链', () => {
  const md = '看 [github](https://github.com/x/y)';
  const links = extractLinks(md);
  assert.equal(links.length, 0);
});

test('buildBacklinks: 反向图 target -> [sources]', () => {
  const files = [
    { path: 'kb/a.md', text: '看 [B](./b.md)' },
    { path: 'kb/b.md', text: '看 [A](./a.md)' },
    { path: 'kb/c.md', text: '同时引 [A](./a.md) 和 [B](./b.md)' },
  ];
  const bl = buildBacklinks(files);
  assert.deepEqual(bl['kb/a.md'].sort(), ['kb/b.md', 'kb/c.md'].sort());
  assert.deepEqual(bl['kb/b.md'].sort(), ['kb/a.md', 'kb/c.md'].sort());
  assert.equal(bl['kb/c.md'], undefined);  // c 没被引
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/backlinks.test.js`
Expected: `extractLinks is not a function`

- [ ] **Step 3: 在 build-index.js 加 extractLinks + buildBacklinks**

在 `scripts/build-index.js` 中 `buildSearchIndex` 之后、`scanDir` 之前插入：

```javascript
// ============================================================
// 反向链接：扫描 .md 提取链接 -> target 反向图
// ============================================================

function extractLinks(text) {
  const links = new Set();
  // ](./x.md) 和 ](../x.md)
  const mdLinkRe = /\]\((\.{1,2}\/[^)]+\.md)(?:#[^)]*)?\)/g;
  let m;
  while ((m = mdLinkRe.exec(text))) links.add(m[1]);
  // [[./x.md]]
  const bracketLinkRe = /\[\[(\.{1,2}\/[^\]]+\.md)\]\]/g;
  while ((m = bracketLinkRe.exec(text))) links.add(m[1]);
  return Array.from(links);
}

function buildBacklinks(files) {
  const { resolveRelativeMd } = require('./lib.js');
  const bl = {};
  files.forEach(src => {
    const links = extractLinks(src.text);
    links.forEach(link => {
      const resolved = resolveRelativeMd(src.path, link);
      const target = resolved.path;
      if (!bl[target]) bl[target] = [];
      if (!bl[target].includes(src.path)) bl[target].push(src.path);
    });
  });
  return bl;
}
```

修改 `main()`，在搜索索引构建后加：

```javascript
  const backlinks = buildBacklinks(flatFiles);
```

修改 manifest 输出：

```javascript
  const manifest = {
    categories: categories,
    searchIndex: searchIndex,
    searchFiles: searchFiles,
    backlinks: backlinks,
  };
```

修改 `module.exports`：

```javascript
module.exports = {
  parseFrontmatter, scanDir, countFiles, generateIndexMd,
  tokenize, buildSearchIndex, extractLinks, buildBacklinks
};
```

- [ ] **Step 4: 跑反向链接测试通过**

Run: `node --test tests/backlinks.test.js`
Expected: 4 个测试全 pass

- [ ] **Step 5: 在 overview.html 加搜索框**

打开 `overview.html`，找到导航容器位置，在适当位置（通常在分类树之上）加入：

```html
<input
  type="text"
  id="kb-search"
  placeholder="🔍 搜索知识库..."
  style="width:100%;padding:8px;margin:8px 0;border:1px solid #ccc;border-radius:4px;"
  oninput="onSearchInput(this.value)"
/>
<div id="kb-search-results" style="display:none;margin:8px 0;"></div>
```

- [ ] **Step 6: 在 scripts/app.js 加搜索逻辑 + 反向链接渲染**

在 `scripts/app.js` 内（搜 `viewContent` 函数附近）加入：

```javascript
// ============================================================
// 全文搜索（实时 filter）
// ============================================================
var __searchDebounceTimer = null;
function onSearchInput(query) {
  clearTimeout(__searchDebounceTimer);
  __searchDebounceTimer = setTimeout(function() { performSearch(query); }, 100);
}

function performSearch(query) {
  var results = document.getElementById('kb-search-results');
  if (!query || query.trim().length < 1) {
    results.style.display = 'none';
    return;
  }
  if (!window.__manifest || !window.__manifest.searchIndex) {
    results.innerHTML = '<em>搜索索引未加载</em>';
    results.style.display = 'block';
    return;
  }
  var idx = window.__manifest.searchIndex;
  var files = window.__manifest.searchFiles;
  var q = query.trim().toLowerCase();
  // 拆 query 为 tokens（与 build-index 一致）
  var tokens = [];
  (q.match(/[a-zA-Z0-9_]+/g) || []).forEach(function(t) { if (t.length >= 2) tokens.push(t); });
  (q.match(/[一-鿿]/g) || []).forEach(function(c) { tokens.push(c); });
  if (tokens.length === 0) {
    results.style.display = 'none';
    return;
  }
  // AND 匹配：取所有 token 命中文件的交集
  var hitSet = null;
  tokens.forEach(function(t) {
    var hits = idx[t] || [];
    var hitsSet = new Set(hits);
    if (hitSet === null) {
      hitSet = hitsSet;
    } else {
      hitSet = new Set(Array.from(hitSet).filter(function(x) { return hitsSet.has(x); }));
    }
  });
  var matched = Array.from(hitSet || []).map(function(i) { return files[i]; }).slice(0, 20);
  if (matched.length === 0) {
    results.innerHTML = '<em>未找到匹配</em>';
  } else {
    results.innerHTML = matched.map(function(f) {
      return '<div style="padding:4px 0;"><span class="kb-link" onclick="viewContent(\'' + f.path + '\')">' + f.path + '</span></div>';
    }).join('');
  }
  results.style.display = 'block';
}
```

**先定位 app.js 的关键变量**（不要凭印象，先 grep）：

```bash
grep -n "function viewContent" scripts/app.js     # 找函数定义行
grep -n "__manifest" scripts/app.js               # 看 manifest 是否已挂 window 全局
grep -nE "(innerHTML|insertAdjacentHTML)" scripts/app.js | head -10  # 找渲染目标 DOM
```

确定以下三个值后再写代码：
- `PATH_PARAM_NAME` = viewContent 函数的入参名（通常是 `path`）
- `MANIFEST_GLOBAL` = manifest 全局变量名（可能是 `window.__manifest`、`window.MANIFEST`、或某个 module-scope 变量；如果尚未挂 window，需要在 manifest fetch 完成的回调中加 `window.__manifest = data;`）
- `TARGET_DOM_ID` = 渲染目标元素的 id（grep `getElementById` 找到 viewContent 内的那个）

在 `viewContent` 函数内**渲染 markdown 完成之后**（通常紧跟 `marked.parse(...)` 调用后），追加：

```javascript
  // 渲染反向链接（被以下文件引用）
  if (MANIFEST_GLOBAL && MANIFEST_GLOBAL.backlinks) {
    var refs = MANIFEST_GLOBAL.backlinks[PATH_PARAM_NAME] || [];
    if (refs.length > 0) {
      var backHtml = '<hr><div style="margin-top:16px;color:#666;"><strong>被以下文件引用：</strong><ul>';
      refs.forEach(function(r) {
        backHtml += '<li><span class="kb-link" onclick="viewContent(\'' + r + '\')">' + r + '</span></li>';
      });
      backHtml += '</ul></div>';
      document.getElementById('TARGET_DOM_ID').insertAdjacentHTML('beforeend', backHtml);
    }
  }
```

把上面三个 `MANIFEST_GLOBAL` / `PATH_PARAM_NAME` / `TARGET_DOM_ID` 替换为 grep 找到的实际名字。

- [ ] **Step 7: 启动 server.sh 手动验证**

```bash
./serve.sh &
sleep 2
open http://localhost:8765
```

在浏览器中：
1. 顶部搜索框输入"agent"，验证下拉出现匹配项 + 点击可跳转
2. 进入一个被多文件引用的页面（如 `kb/技术/AI/Claude-Code/Harness Engineering...md`），底部应出现"📎 被以下文件引用"

- [ ] **Step 8: Commit**

```bash
git add scripts/build-index.js scripts/app.js overview.html tests/backlinks.test.js
git commit -m "feat: A5 part 2 反向链接 + 前端搜索 UI

build-index.js 新增 extractLinks + buildBacklinks，manifest.json 加 backlinks 字段。
overview.html 顶部加搜索框，app.js 加实时 filter（debounce 100ms） + 反向链接渲染区。"
```

---

### Task 5: anchor 存活检查（B3）

**Files:**
- Create: `scripts/check-anchors.js`
- Create: `tests/anchor-check.test.js`
- Modify: `scripts/arch-lint.sh`

- [ ] **Step 1: 写失败测试**

新建 `tests/anchor-check.test.js`：

```javascript
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { findBrokenAnchors } = require('../scripts/check-anchors.js');

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anchor-test-'));
  try { fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('findBrokenAnchors: 锚点匹配现有 H2 -> 不报', () => {
  withTempDir(dir => {
    fs.writeFileSync(path.join(dir, 'a.md'), '看 [link](./b.md#section-one)');
    fs.writeFileSync(path.join(dir, 'b.md'), '## Section One\ncontent');
    const broken = findBrokenAnchors(dir);
    assert.deepEqual(broken, []);
  });
});

test('findBrokenAnchors: 锚点不存在 -> 报告', () => {
  withTempDir(dir => {
    fs.writeFileSync(path.join(dir, 'a.md'), '看 [link](./b.md#missing-section)');
    fs.writeFileSync(path.join(dir, 'b.md'), '## Real Section\ncontent');
    const broken = findBrokenAnchors(dir);
    assert.equal(broken.length, 1);
    assert.equal(broken[0].source.endsWith('a.md'), true);
    assert.equal(broken[0].anchor, 'missing-section');
  });
});

test('findBrokenAnchors: 内联代码不影响 anchor 匹配（slugify stripInline）', () => {
  withTempDir(dir => {
    fs.writeFileSync(path.join(dir, 'a.md'), '看 [link](./b.md#3-tool-注解的内部机制)');
    fs.writeFileSync(path.join(dir, 'b.md'), '## 3. `@Tool` 注解的内部机制');
    const broken = findBrokenAnchors(dir);
    assert.deepEqual(broken, []);
  });
});

test('findBrokenAnchors: 链接无锚点 -> 不报', () => {
  withTempDir(dir => {
    fs.writeFileSync(path.join(dir, 'a.md'), '看 [link](./b.md)');
    fs.writeFileSync(path.join(dir, 'b.md'), '## Section');
    const broken = findBrokenAnchors(dir);
    assert.deepEqual(broken, []);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/anchor-check.test.js`
Expected: `Cannot find module '../scripts/check-anchors.js'`

- [ ] **Step 3: 实现 scripts/check-anchors.js**

新建 `scripts/check-anchors.js`：

```javascript
#!/usr/bin/env node
/**
 * check-anchors.js — 锚点存活检查
 *
 * 扫描 kb/ 下所有 md 文件，对每个含 #anchor 的链接，验证目标文件中存在对应标题。
 * 使用 lib.js 的 slugify + stripInline 计算 anchor，与浏览器渲染逻辑保持一致。
 *
 * 用法: node scripts/check-anchors.js [root_dir]
 * 退出码: 0（无失效），始终 0（警告级别，不阻断 SessionStart）
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { slugify, stripInline, resolveRelativeMd } = require('./lib.js');

function walkMd(dir) {
  const result = [];
  function walk(d) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.md')) result.push(full);
    }
  }
  walk(dir);
  return result;
}

function extractHeadings(content) {
  const slugs = new Set();
  let inCode = false;
  content.split('\n').forEach(line => {
    if (/^```/.test(line)) { inCode = !inCode; return; }
    if (inCode) return;
    const m = /^(#{1,6})\s(.+)$/.exec(line);
    if (m) slugs.add(slugify(stripInline(m[2])));
  });
  return slugs;
}

function findBrokenAnchors(root) {
  const broken = [];
  const files = walkMd(root);
  const headingCache = new Map();

  files.forEach(srcAbs => {
    const srcRel = path.relative(root, srcAbs);
    const content = fs.readFileSync(srcAbs, 'utf-8');
    // 匹配 ](path.md#anchor)
    const re = /\]\((\.{0,2}\/[^)]*\.md)#([^)]+)\)/g;
    let m;
    while ((m = re.exec(content))) {
      const linkPath = m[1];
      const anchor = m[2];
      const resolved = resolveRelativeMd(srcRel, linkPath);
      const targetAbs = path.join(root, resolved.path);
      if (!fs.existsSync(targetAbs)) continue; // 死链由别的 lint 报
      let slugs;
      if (headingCache.has(targetAbs)) {
        slugs = headingCache.get(targetAbs);
      } else {
        slugs = extractHeadings(fs.readFileSync(targetAbs, 'utf-8'));
        headingCache.set(targetAbs, slugs);
      }
      if (!slugs.has(anchor)) {
        broken.push({ source: srcAbs, target: resolved.path, anchor: anchor });
      }
    }
  });
  return broken;
}

function main() {
  const root = process.argv[2] || path.resolve(__dirname, '..', 'kb');
  const broken = findBrokenAnchors(root);
  if (broken.length === 0) {
    console.log('  ✓ 所有 anchor 链接有效');
  } else {
    broken.forEach(b => {
      console.log('  ⚠️  ' + b.source);
      console.log('      → ' + b.target + '#' + b.anchor + ' (anchor 不存在)');
    });
  }
  console.log('  结果: ' + broken.length + ' 个失效 anchor');
  process.exit(0); // 警告级，不阻断
}

if (require.main === module) main();

module.exports = { findBrokenAnchors, extractHeadings };
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test tests/anchor-check.test.js`
Expected: 4 个测试全 pass

- [ ] **Step 5: 修改 scripts/arch-lint.sh 加 [14/14]**

在 `scripts/arch-lint.sh` 末尾（line 448 `# ── 汇总 ──` 前）插入：

```bash
# ── 检查 14: anchor 存活检查 ──
echo ""
echo "[14/14] anchor 存活检查..."
node scripts/check-anchors.js
ANCHOR_WARN=$(node scripts/check-anchors.js 2>/dev/null | grep -c "anchor 不存在" || echo "0")
ANCHOR_WARN=$(echo "$ANCHOR_WARN" | awk '{print $1}')
```

同时修改汇总部分（line 450）：

```bash
ALL_WARN=$((WARN + LINK_WARN + CASE_WARN + LINE_WARN + MEM_WARN + DEPS_ISSUES + UNREF_COUNT + DOC_REF_FAIL + ID_CONTRACT_FAIL + NUM_GAP_WARN + ANCHOR_WARN))
```

更新所有原"13"显示改为"14"。也就是把 line 19 的 `[1/13]` 系列全部改为 `[1/14]`、`[2/14]`... `[13/14]`。可用 sed 批量：

```bash
sed -i '' 's|\[\([0-9]*\)/13\]|[\1/14]|g' scripts/arch-lint.sh
```

- [ ] **Step 6: 跑 arch-lint 确认 [14/14] 生效**

Run: `bash scripts/arch-lint.sh 2>&1 | grep "14/14"`
Expected: `[14/14] anchor 存活检查...` + 报告结果

- [ ] **Step 7: Commit**

```bash
git add scripts/check-anchors.js tests/anchor-check.test.js scripts/arch-lint.sh
git commit -m "feat: B3 anchor 存活检查（arch-lint 14/14）

新增 scripts/check-anchors.js + 4 个 fixture 单测。
复用 lib.js 的 slugify+stripInline 保证与浏览器 anchor 一致。
警告级（不阻断 SessionStart）。"
```

---

**G1 收尾**：
```bash
bash test.sh
bash scripts/arch-lint.sh
git push origin kb-uplift-g1-data
```

---

## Group G2: Hook/Lint 增强（worktree: `kb-uplift-g2-hook`）

### Task 6: session-log 改触发条件（A1）

**Files:**
- Modify: `scripts/session-log.sh`
- Create: `tests/session-log.test.js`

- [ ] **Step 1: 写失败测试（mock 文件系统）**

新建 `tests/session-log.test.js`：

```javascript
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function shInTempRepo(commands) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-test-'));
  // 拷贝 session-log.sh
  const scriptSrc = path.resolve(__dirname, '..', 'scripts', 'session-log.sh');
  fs.mkdirSync(path.join(dir, 'scripts'));
  fs.copyFileSync(scriptSrc, path.join(dir, 'scripts', 'session-log.sh'));
  fs.mkdirSync(path.join(dir, '.claude', 'session-logs'), { recursive: true });
  // 初始化 git
  execSync('git init -q && git config user.email t@t && git config user.name t', { cwd: dir });
  fs.writeFileSync(path.join(dir, 'a.txt'), 'init');
  execSync('git add a.txt && git commit -q -m init', { cwd: dir });
  try {
    const result = execSync(commands, { cwd: dir, encoding: 'utf-8' });
    return { result, dir };
  } finally {
    // 留给调用方决定是否清理；自动清理：
    setTimeout(() => fs.rmSync(dir, { recursive: true, force: true }), 100);
  }
}

test('session-log: <5 commit 增量不生成日志', () => {
  const { result, dir } = shInTempRepo(`
    # 制造 3 个 commit
    for i in 1 2 3; do echo "$i" >> a.txt && git add a.txt && git commit -q -m "c$i"; done
    # 没有 .last-checkpoint 时按默认从首个 commit 算 = 全部 commit
    # 这里测试已经有 checkpoint = HEAD~3 的场景，期望<5 跳过
    git rev-parse HEAD > .claude/session-logs/.last-checkpoint
    for i in 4 5 6; do echo "$i" >> a.txt && git add a.txt && git commit -q -m "c$i"; done
    bash scripts/session-log.sh --quiet 2>&1
    ls .claude/session-logs/*.md 2>/dev/null | wc -l
  `);
  // 期望 0 个 md 日志（跳过）
  assert.equal(result.trim().split('\n').pop(), '0');
});

test('session-log: ≥5 commit 增量生成日志', () => {
  const { result, dir } = shInTempRepo(`
    git rev-parse HEAD > .claude/session-logs/.last-checkpoint
    for i in 1 2 3 4 5; do echo "$i" >> a.txt && git add a.txt && git commit -q -m "c$i"; done
    bash scripts/session-log.sh --quiet 2>&1
    ls .claude/session-logs/*.md 2>/dev/null | wc -l
  `);
  assert.equal(result.trim().split('\n').pop(), '1');
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/session-log.test.js`
Expected: 第二个测试 fail（当前 session-log.sh 无 checkpoint 机制，会无条件写日志）

- [ ] **Step 3: 修改 session-log.sh 加 checkpoint 触发**

在 `scripts/session-log.sh` 第 11 行 `LOG_FILE="$LOG_DIR/$DATE.md"` 之后插入：

```bash
CHECKPOINT_FILE="$LOG_DIR/.last-checkpoint"

# ── 触发判定：基于自上次 checkpoint 后的 commit 增量 ──
# 首次运行（无 checkpoint）：以最早的 commit 为基线，不跳过
# 已有 checkpoint：计算 <last_sha>..HEAD 的 commit 数，<5 静默退出
THRESHOLD=5
if [ -f "$CHECKPOINT_FILE" ]; then
  LAST_SHA=$(cat "$CHECKPOINT_FILE")
  if git rev-parse --quiet --verify "$LAST_SHA" >/dev/null 2>&1; then
    NEW_COMMITS=$(git rev-list --count "$LAST_SHA"..HEAD 2>/dev/null || echo 0)
    if [ "$NEW_COMMITS" -lt "$THRESHOLD" ]; then
      [ "${1:-}" != "--quiet" ] && echo "[session-log] 跳过：仅 $NEW_COMMITS 个新 commit（阈值 $THRESHOLD）"
      exit 0
    fi
  fi
fi
```

在文件最末尾（line 113 之后）加：

```bash
# 推进 checkpoint 到当前 HEAD
git rev-parse HEAD > "$CHECKPOINT_FILE" 2>/dev/null
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test tests/session-log.test.js`
Expected: 2 个测试全 pass

- [ ] **Step 5: 把 checkpoint 文件加 .gitignore**

```bash
echo ".claude/session-logs/.last-checkpoint" >> .gitignore
```

- [ ] **Step 6: Commit**

```bash
git add scripts/session-log.sh tests/session-log.test.js .gitignore
git commit -m "feat: A1 session-log 改触发条件（commit 增量阈值 5）

session-log.sh 加 .last-checkpoint 机制：自上次写日志后
新 commit <5 静默跳过。避免 Stop hook 频繁触发产生
低密度日志（数据：30 天 176 commits / 仅 3 个日志说明
原触发条件与真实使用流脱节）。"
```

---

### Task 7: 内容质量 lint（A4）

**Files:**
- Modify: `scripts/arch-lint.sh`
- Create: `tests/content-quality.test.js`

- [ ] **Step 1: 写失败测试**

新建 `tests/content-quality.test.js`：

```javascript
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

function withTempKb(files, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cq-test-'));
  Object.entries(files).forEach(([rel, content]) => {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  });
  try { fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

const lintCmd = 'bash ' + path.resolve(__dirname, '..', 'scripts', 'check-content-quality.sh');

test('content-quality: 含 mermaid 块 -> pass', () => {
  withTempKb({
    'kb/技术/x.md': '---\ntitle: X\n---\n# X\n```mermaid\nflowchart LR\nA-->B\n```'
  }, dir => {
    const out = execSync(lintCmd, { cwd: dir, encoding: 'utf-8' });
    assert.ok(!out.includes('kb/技术/x.md'), '不应报警');
  });
});

test('content-quality: 仅纯文字 -> 警告', () => {
  withTempKb({
    'kb/技术/y.md': '---\ntitle: Y\n---\n# Y\n纯文字内容，无 demo 无表格无 mermaid'
  }, dir => {
    const out = execSync(lintCmd, { cwd: dir, encoding: 'utf-8' });
    assert.ok(out.includes('kb/技术/y.md'), '应报警');
  });
});

test('content-quality: 读书笔记/ 路径豁免', () => {
  withTempKb({
    'kb/读书笔记/book.md': '---\ntitle: Book\n---\n# Book\n纯文字感悟'
  }, dir => {
    const out = execSync(lintCmd, { cwd: dir, encoding: 'utf-8' });
    assert.ok(!out.includes('kb/读书笔记/book.md'), '白名单应豁免');
  });
});

test('content-quality: 含代码块 -> pass', () => {
  withTempKb({
    'kb/技术/z.md': '---\ntitle: Z\n---\n# Z\n```\ncode\n```'
  }, dir => {
    const out = execSync(lintCmd, { cwd: dir, encoding: 'utf-8' });
    assert.ok(!out.includes('kb/技术/z.md'));
  });
});

test('content-quality: 含表格 -> pass', () => {
  withTempKb({
    'kb/技术/t.md': '---\ntitle: T\n---\n# T\n| col1 | col2 |\n|---|---|\n| a | b |'
  }, dir => {
    const out = execSync(lintCmd, { cwd: dir, encoding: 'utf-8' });
    assert.ok(!out.includes('kb/技术/t.md'));
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/content-quality.test.js`
Expected: `bash: ...check-content-quality.sh: No such file or directory`

- [ ] **Step 3: 实现独立 check-content-quality.sh（便于单测）**

新建 `scripts/check-content-quality.sh`：

```bash
#!/bin/bash
# check-content-quality.sh — 内容具象度检查
# 每个 kb/ 下非白名单的 md 文件至少含 mermaid / 代码块 / 表格 之一。
# 警告级，不阻断。
set -uo pipefail

cd "$(dirname "$0")/.." 2>/dev/null || cd "$(pwd)"

# 白名单：目录路径前缀（允许全文字内容）
WHITELIST=(
  "kb/读书笔记"
)

is_whitelisted() {
  local file="$1"
  for prefix in "${WHITELIST[@]}"; do
    case "$file" in
      "$prefix"/*|"$prefix"*) return 0 ;;
    esac
  done
  return 1
}

WARN_COUNT=0
while IFS= read -r -d '' file; do
  if is_whitelisted "$file"; then
    continue
  fi
  HAS_MERMAID=$(grep -c '^```mermaid' "$file" 2>/dev/null || echo 0)
  HAS_CODE=$(grep -c '^```' "$file" 2>/dev/null || echo 0)
  HAS_TABLE=$(grep -cE '^\|.*\|' "$file" 2>/dev/null || echo 0)
  if [ "$HAS_MERMAID" -eq 0 ] && [ "$HAS_CODE" -eq 0 ] && [ "$HAS_TABLE" -eq 0 ]; then
    echo "  ⚠️  $file — 缺少 mermaid / 代码块 / 表格 任一具象元素"
    WARN_COUNT=$((WARN_COUNT + 1))
  fi
done < <(find kb -name "*.md" -print0 2>/dev/null)

echo "  结果: $WARN_COUNT 个文件缺具象元素"
```

赋可执行权限：

```bash
chmod +x scripts/check-content-quality.sh
```

- [ ] **Step 4: 修改 scripts/arch-lint.sh 加 [15/15]**

在 line 448（汇总前）插入：

```bash
# ── 检查 15: 内容具象度（A4） ──
echo ""
echo "[15/15] 内容具象度（mermaid / 代码块 / 表格 ≥1）..."
CONTENT_OUT=$(bash scripts/check-content-quality.sh 2>&1)
echo "$CONTENT_OUT"
CONTENT_WARN=$(echo "$CONTENT_OUT" | grep -c "缺少 mermaid" || echo "0")
CONTENT_WARN=$(echo "$CONTENT_WARN" | awk '{print $1}')
```

修改汇总：

```bash
ALL_WARN=$((WARN + LINK_WARN + CASE_WARN + LINE_WARN + MEM_WARN + DEPS_ISSUES + UNREF_COUNT + DOC_REF_FAIL + ID_CONTRACT_FAIL + NUM_GAP_WARN + ANCHOR_WARN + CONTENT_WARN))
```

**关于编号冲突的策略**（重要）：

G1 和 G2 都改 `scripts/arch-lint.sh`。集成时必然冲突。策略：

- **G2 worktree 内部**：**不批量改前 13 个的编号**。直接在 arch-lint.sh 末尾追加 `[14/14] 内容具象度`（先用 14 假设 G1 不存在）。worktree 内单跑 arch-lint 时编号 14 与汇总文字一致，能正常工作。
- **集成顺序**：G1 先合入 main（G1 已经把所有 [N/13] 改为 [N/14] 且加了 [14/14] anchor）。
- **G2 rebase 到 main 时**：会在 arch-lint.sh 末尾两处冲突（G1 加的 [14/14] anchor + G2 加的 [14/14] 内容质量都想在末尾）。解决：
  1. 保留 G1 的 [14/14] anchor 不动
  2. 把 G2 加的那段编号从 `[14/14] 内容具象度` 改成 `[15/15] 内容具象度`
  3. 把前 13 个的总数 `/14` 全改为 `/15`：`sed -i '' 's|\[\([0-9]*\)/14\]|[\1/15]|g' scripts/arch-lint.sh`
  4. 把 G1 加的 anchor 那段从 `[14/14] anchor` 改为 `[14/15] anchor`（sed 应该已经做了，验证一下）
  5. 在汇总 `ALL_WARN=$((...))` 一行加上 `+ CONTENT_WARN`

集成后跑一次 `bash scripts/arch-lint.sh 2>&1 | grep "/15"` 应该看到 15 个 `[N/15]` 行。

**G2 worktree 内部当前 step**：仅在 arch-lint.sh 末尾追加 `[14/14] 内容具象度` 段（即上面 `[15/15]` 改成 `[14/14]`），不动其他编号。先跑通本 worktree 的 lint，集成时再统一调整。

- [ ] **Step 5: 跑测试通过**

Run: `node --test tests/content-quality.test.js`
Expected: 5 个测试全 pass

- [ ] **Step 6: 跑 arch-lint 验证**

Run: `bash scripts/arch-lint.sh 2>&1 | tail -10`
Expected: 输出 `[15/15] 内容具象度...`

- [ ] **Step 7: Commit**

```bash
git add scripts/arch-lint.sh scripts/check-content-quality.sh tests/content-quality.test.js
git commit -m "feat: A4 内容质量 lint（arch-lint 15/15 + 读书笔记白名单）

新增 scripts/check-content-quality.sh + 5 个 fixture 单测。
非白名单 md 必须含 mermaid / 代码块 / 表格 任一。
白名单：kb/读书笔记/ 路径前缀豁免。"
```

---

### Task 8: PostToolUse 沉淀验证 hook（B6）

**Files:**
- Create: `scripts/verify-claim.sh`
- Modify: `.claude/settings.local.json`
- Modify: `exit-check.sh`

- [ ] **Step 1: 实现 scripts/verify-claim.sh**

新建 `scripts/verify-claim.sh`：

```bash
#!/bin/bash
# verify-claim.sh — PostToolUse hook：验证 Write/Edit 写入的 kb/ 或 memory/ 文件确实存在
# 输出: append 到 .claude/claim-ledger.log
# 入参（环境变量）: $CLAUDE_TOOL_NAME, $CLAUDE_TOOL_INPUT (JSON)
set -uo pipefail
cd "$(dirname "$0")/.."

LEDGER=".claude/claim-ledger.log"
mkdir -p "$(dirname "$LEDGER")"

TOOL="${CLAUDE_TOOL_NAME:-unknown}"
INPUT="${CLAUDE_TOOL_INPUT:-{}}"

# 用 python3 安全提取 file_path（避免 jq 依赖）
FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    p = d.get('file_path') or d.get('notebook_path') or ''
    print(p)
except Exception:
    print('')
" 2>/dev/null)

# 仅处理 kb/ 或 memory/ 路径
case "$FILE_PATH" in
  */kb/*|*/memory/*|kb/*|memory/*)
    ;;
  *)
    exit 0
    ;;
esac

TS=$(date "+%Y-%m-%d %H:%M:%S")
if [ -f "$FILE_PATH" ]; then
  echo "$TS | $TOOL | $FILE_PATH | exists" >> "$LEDGER"
else
  echo "$TS | $TOOL | $FILE_PATH | MISSING" >> "$LEDGER"
  echo "⚠️  verify-claim: 声称写入但文件不存在: $FILE_PATH" >&2
fi
```

```bash
chmod +x scripts/verify-claim.sh
```

- [ ] **Step 2: 在 .claude/settings.local.json 加 PostToolUse hook**

打开 `.claude/settings.local.json`，在 `hooks` 对象内加：

```json
{
  "PostToolUse": [
    {
      "matcher": "Write|Edit",
      "hooks": [
        {
          "type": "command",
          "command": "bash scripts/verify-claim.sh",
          "timeout": 10
        }
      ]
    }
  ]
}
```

完整修改后 `hooks` 段：

```json
"hooks": {
  "SessionStart": [
    {
      "hooks": [
        { "type": "command", "command": "bash scripts/preflight.sh", "timeout": 30 }
      ]
    }
  ],
  "Stop": [
    {
      "hooks": [
        { "type": "command", "command": "bash exit-check.sh", "timeout": 60 }
      ]
    }
  ],
  "PostToolUse": [
    {
      "matcher": "Write|Edit",
      "hooks": [
        { "type": "command", "command": "bash scripts/verify-claim.sh", "timeout": 10 }
      ]
    }
  ]
}
```

- [ ] **Step 3: 把 claim-ledger.log 加 .gitignore**

```bash
echo ".claude/claim-ledger.log" >> .gitignore
```

- [ ] **Step 4: 在 exit-check.sh 加 [8/8] 沉淀声明审计**

在 `exit-check.sh` 末尾（最后 `echo ""` + `echo "========== 退出检查完成 =========="` 前）插入：

```bash
# [8/8] 沉淀声明审计
echo ""
echo "[8/8] 沉淀声明审计..."
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
```

把 exit-check.sh 顶部所有 `[N/7]` 改为 `[N/8]`：

```bash
sed -i '' 's|\[\([0-9]*\)/7\]|[\1/8]|g' exit-check.sh
```

- [ ] **Step 5: 手动验证 hook 触发**

```bash
# 模拟 Write 调用
CLAUDE_TOOL_NAME="Write" CLAUDE_TOOL_INPUT='{"file_path":"kb/不存在.md"}' bash scripts/verify-claim.sh
cat .claude/claim-ledger.log
```
Expected: ledger 出现 `MISSING` 条目，stderr 有警告

```bash
# 测试 kb/ 外路径不触发
CLAUDE_TOOL_NAME="Write" CLAUDE_TOOL_INPUT='{"file_path":"random.txt"}' bash scripts/verify-claim.sh
# 不应有新行写入 ledger
```

清理测试数据：
```bash
rm .claude/claim-ledger.log
```

- [ ] **Step 6: Commit**

```bash
git add scripts/verify-claim.sh .claude/settings.local.json exit-check.sh .gitignore
git commit -m "feat: B6 PostToolUse 沉淀验证 hook

只对 kb/ + memory/ 路径下的 Write/Edit 触发。
写入后立即验证文件存在性 → 记录到 .claude/claim-ledger.log。
exit-check 加 [8/8] 沉淀声明审计 → 列出本 session 中 MISSING 条目。"
```

---

**G2 收尾**：
```bash
bash test.sh
bash exit-check.sh
git push origin kb-uplift-g2-hook
```

---

## Group G3: 规则结构化（worktree: `kb-uplift-g3-skills`）

### Task 9: 创建 auto-commit-discipline skill

**Files:**
- Create: `.claude/skills/auto-commit-discipline/SKILL.md`

- [ ] **Step 1: 新建目录 + SKILL.md**

```bash
mkdir -p .claude/skills/auto-commit-discipline
```

新建 `.claude/skills/auto-commit-discipline/SKILL.md`：

```markdown
---
name: auto-commit-discipline
description: Use when finishing any batch of file changes in this KB project (one logical topic complete). Also use before sending response to user when there are uncommitted changes. Enforces: conventional commits in 中/英, never amend, ≥5 unpushed triggers auto-push, never skip hooks.
---

# Auto-Commit Discipline (ANS AI Auto Notes 项目)

## 触发条件

**MUST invoke when**:
1. 完成一个逻辑主题的批量文件变更（如：一篇笔记沉淀、一个脚本写完、一组测试通过）
2. 即将向用户发送响应但 `git status` 非 clean
3. Stop hook 前（与 exit-check.sh 联动）

## 规则

### Conventional Commits 格式
- `feat: xxx` — 新功能
- `fix: xxx` — 修复 bug
- `chore: xxx` — 维护性工作
- `docs: xxx` — 文档/知识内容变更
- `refactor: xxx` — 重构（不改变行为）

消息用中文或英文均可，简明描述"做了什么、为什么"。

### 提交动作纪律
- **永不 amend**：CLAUDE.md 已经 push 过的 commit 不能 amend
- **永不 --no-verify**：不跳过 pre-commit / pre-push hooks
- **永不 git add -A 全量加**：明确 `git add <具体文件>` 避免误提交敏感文件
- **HEREDOC commit 多行 message**：

```bash
git commit -m "$(cat <<'EOF'
feat: xxx

详细说明...
EOF
)"
```

### 自动 push 阈值
- 未 push commit ≥5 → exit-check.sh 自动跑 test 通过后 push
- 未 push commit <5 → 仅提示，不自动 push
- pre-push hook 兜底：`test.sh` 通过 + mermaid 守恒检查通过

## 自检 Checklist（提交前）

- [ ] `git diff --cached` 已 review
- [ ] commit message 符合 Conventional Commits
- [ ] 未包含敏感文件（.env / credentials / *.key）
- [ ] 未跳过 hooks
- [ ] 未 amend 已 push 的 commit

## 反面案例

- ❌ "我打包完成多件事后一起 commit" → 应该每个逻辑主题完成立即 commit
- ❌ "用户没催 commit，我先继续干别的" → 主动性在 AI 这边
- ❌ `git commit --amend` 修改已 push 的 commit → 永不

## 与其他 skill / hook 的关系

- `exit-check.sh [7/8]` 检查未 push commit 数量，≥5 自动 push
- `pre-push hook` 跑 test 兜底
- `verify-claim.sh` (PostToolUse hook) 验证 kb/ 文件写入

详见 [CLAUDE.md 索引段](../../../CLAUDE.md)。
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/auto-commit-discipline/
git commit -m "feat: A3 part 1 新增 auto-commit-discipline skill

从 CLAUDE.md「Git 规则」和「会话退出检查」提取。
触发条件：完成一批文件变更 / 响应前未 commit / Stop hook 前。
description 字段精准化，确保 superpowers 自动加载触发。"
```

---

### Task 10: 创建 kb-content-style skill

**Files:**
- Create: `.claude/skills/kb-content-style/SKILL.md`

- [ ] **Step 1: 新建 SKILL.md**

```bash
mkdir -p .claude/skills/kb-content-style
```

新建 `.claude/skills/kb-content-style/SKILL.md`：

```markdown
---
name: kb-content-style
description: Use when writing or editing any markdown file under kb/ in this ANS AI Auto Notes project. Enforces Mermaid-first visuals, demo retention over abstraction, file splitting when >1000 lines, continuous chapter numbering, and Chinese filename = frontmatter title rule.
---

# KB Content Style (ANS AI Auto Notes 项目)

## 触发条件

**MUST invoke when**:
- 写入 / 编辑 `kb/` 目录下任何 .md 文件
- 准备拆分 kb/ 文件时
- 给一个新的 kb/ 笔记起文件名时

## 笔记风格规则

### 1. 保留 demo 和示例
笔记不是抽象提炼，而是要保留对话中给出的具体例子、图解、类比说明。**用户喜欢带 demo 的 QA 风格，反对干瘪的总结**。

### 2. Mermaid 优先
需要画图时优先使用 ` ```mermaid ` 块（overview.html 会渲染为可视化 SVG）：
- 流程图 → `flowchart TD/LR`
- 时序图 → `sequenceDiagram`
- 架构图 → `flowchart TB` + `subgraph`
ASCII 框图仅在 Mermaid 不适用时使用。

### 3. 重组而非堆砌
同一主题的多次对话要持续归纳合并为自上而下的结构化文档，不应出现多个同日期独立小节堆在一起。

### 4. 反面例子
"卷积操作是通过滤波器在输入矩阵上进行滑动窗口运算提取特征" —— 这种纯定义就是太抽象。

### 5. 判断标准
读起来像教科书定义 = 太抽象。读起来像有人拿草稿纸演示 = 对的。

## 文件组织规则

### 同主题聚合
同主题持续追加到同一文件，不按日期拆分。文件内**最新内容追加在顶部**，以 `## YYYY-MM-DD - 标题` 为二级标题。

### 中文文件名（强制）
磁盘文件名必须与 frontmatter `title` 一致：
- 冒号 `:` → 全角 `：`
- 移除 `/ \ * ? " < > |` 非法字符
- 多空格合并为一个
- 过长（>60 字）截断

新文件创建时直接用中文名；旧文件重命名用 `node scripts/rename-mapping.js --apply`。

### 目录深度
默认两层（`技术/Java/jvm-gc.md`）。允许第三层的条件：每个子目录 ≥3 篇文件 + 子领域边界清晰。

## 文件拆分规则

满足以下**任意两条**时主动提案拆分：

| 维度 | 阈值 |
|---|---|
| 行数 | >1000 关注，>1500 必须拆 |
| 章节数 | >7-8 个 `##` |
| 主题凝聚度 | 覆盖 3+ 个可独立成文的方向 |

**拆分后**：原文件保留核心 + 指向子文件链接；章节编号重新从 1 整理（无跳号）；更新 INDEX.md 和 overview.html。

## 章节编号 + 标题 ID

- 使用 `## N.` 样式时，h2 编号必须从 1（或 0）连续递增
- 内联代码不影响 slugify：`buildToc` 在 slugify 前必须 `stripInline`
- 修改 lib.js slugify 或 heading renderer 时，必须同步更新 lib.js + app.js

## 跨文件关联

涉及多维度的知识点（如《我看见的世界》提到 RNN）：
- 读书笔记侧重阅读上下文 + 感悟
- 技术文件侧重纯技术干货
- **两处不是复制**，互留链接 `相关: ../技术/ai/rnn.md`

## 严禁口头沉淀

结束响应前，如果声称"已沉淀到 xxx.md"，**必须先用 Read 工具确认文件确实存在于磁盘**。宁可不说"已沉淀"，也不允许文件不存在却说已沉淀。

## 自检 Checklist

- [ ] 新增内容是否含 mermaid / 代码块 / 表格 任一
- [ ] 是否过度抽象（自问："像教科书还是像演示？"）
- [ ] 章节编号是否连续
- [ ] 文件名（中文）= frontmatter title
- [ ] 行数是否超过 1000（>1000 关注 / >1500 必拆）
- [ ] "已沉淀"声称是否对应实际写入

详见 [CLAUDE.md 索引段](../../../CLAUDE.md)。
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/kb-content-style/
git commit -m "feat: A3 part 2 新增 kb-content-style skill

从 CLAUDE.md「笔记风格规则」+「文件拆分规则」+
「章节编号与标题 ID 规则」+「严禁口头沉淀」整合。
触发条件：写入/编辑 kb/ 下任何 md 文件。"
```

---

### Task 11: 创建 kb-tdd-discipline skill

**Files:**
- Create: `.claude/skills/kb-tdd-discipline/SKILL.md`

- [ ] **Step 1: 新建 SKILL.md**

```bash
mkdir -p .claude/skills/kb-tdd-discipline
```

新建 `.claude/skills/kb-tdd-discipline/SKILL.md`：

```markdown
---
name: kb-tdd-discipline
description: Use when modifying any file under scripts/ or tests/ in this ANS AI Auto Notes project. Also use when fixing any bug in markdown rendering, path resolution, frontmatter parsing, or static lint scripts. Enforces red-green-refactor cycle and bug-reproduction-test-first.
---

# KB TDD Discipline (ANS AI Auto Notes 项目)

## 触发条件

**MUST invoke when**:
- 修改 `scripts/*.{sh,js}` 文件
- 修改 `tests/*.test.js` 文件
- 修复以下区域的 bug（错误趋向区域）：
  - markdown 渲染链路（marked 配置、自定义 renderer 如 renderKbLink）
  - 路径解析（resolveRelativeMd、build-index 扫描）
  - frontmatter 解析（build-index.js）
  - 静态校验脚本（check-overview.js、arch-lint.sh）

## 软 TDD 流程

### 错误趋向区域：先红后绿
1. **写一个失败测试**：能复现问题
2. **跑测试确认失败**（红）— `node --test tests/xxx.test.js`
3. **写最小实现**让测试通过
4. **跑测试确认通过**（绿）
5. **重构**（可选）
6. **Commit**

### Bug 修复：先复现再修
1. 先在 `tests/` 加一个能复现该 bug 的失败测试
2. 跑测试确认 fail（即 bug 真实存在）
3. 修 code 让测试转绿
4. Commit（msg 含 `fix: xxx`）

## 豁免（不强制 TDD）

- 纯文本编辑：kb/*.md、CLAUDE.md、README 等内容修订
- UI 样式调整：overview.html 的 CSS
- 配置变更：settings.local.json、.gitignore

## 测试入口

- 推荐：`bash test.sh`（spec reporter）
- 直接：`node --test tests/*.test.js`
- 单文件：`node --test tests/lib.test.js`

## 测试文件组织

```
tests/
├── lib.test.js              ← scripts/lib.js 纯函数
├── link-renderer.test.js    ← marked link renderer 输出契约
├── build-index.test.js      ← manifest.json 数据完整性
└── integration.test.js      ← 全量 kb/ markdown 链接静态解析
```

**命名约定**：新测试按"被测对象"命名 `<source>.test.js`。

**Node 中可用的纯逻辑**：统一放 `scripts/lib.js`（UMD 双导出，浏览器和 Node 都能加载）。

## Push 前自动跑测试（双层 gate）

1. **`scripts/git-hooks/pre-push`** — git 层硬拦截
2. **`exit-check.sh` 的 auto-push 块** — Stop 时 ≥5 commits 未 push 时先跑 test 通过才 push

**首次安装 hook**：`bash scripts/install-hooks.sh`（新机器克隆后跑一次）。

## 反面案例

- ❌ "改了脚本但没加测试，下次出 bug 不知道为什么" → 应先加 failing test 再改 code
- ❌ "测试随便写一行，主要是为了 git 不报错" → 测试要真验证行为，不只是 assert.ok(true)
- ❌ "跳过 pre-push hook 因为测试'肯定能过'" → 不允许 --no-verify

## 自检 Checklist

- [ ] 修改 scripts/ 时是否有对应 test 文件？
- [ ] 修 bug 时是否先加复现 test？
- [ ] 新逻辑是否走完整的红→绿→重构循环？
- [ ] push 前 `bash test.sh` 全绿？

详见 [CLAUDE.md 索引段](../../../CLAUDE.md)。
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/kb-tdd-discipline/
git commit -m "feat: A3 part 3 新增 kb-tdd-discipline skill

从 CLAUDE.md「测试纪律（软 TDD）」整合。
触发条件：修改 scripts/ 或 tests/，或修 markdown 渲染/路径解析/lint bug。
明确豁免清单，明确测试入口和文件组织。"
```

---

### Task 12: CLAUDE.md 缩减为索引

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Backup CLAUDE.md 当前版本到 attic（可选 safety）**

```bash
cp CLAUDE.md CLAUDE.md.bak
```

- [ ] **Step 2: 修改「Git 规则」段为索引**

打开 `CLAUDE.md`，找到 `### Git 规则` 段（约 line 138），替换为：

```markdown
### Git 规则

详见 [.claude/skills/auto-commit-discipline/SKILL.md](.claude/skills/auto-commit-discipline/SKILL.md) —— Claude Code 会按 skill 触发条件自动加载完整规则。核心要点：
- 完成一批文件变更立即 commit（不等用户提醒）
- Conventional Commits 格式
- ≥5 commits 未 push 时 Stop hook 自动 push
- 永不 amend 已 push 的 commit、永不 --no-verify
```

- [ ] **Step 3: 修改「笔记风格规则」+「文件拆分规则」+「章节编号规则」+「严禁口头沉淀」为索引**

找到 `### 笔记风格规则（重要）` 段，连同之后 4-5 个相关段，替换为：

```markdown
### 笔记风格 & 拆分 & 章节规则

详见 [.claude/skills/kb-content-style/SKILL.md](.claude/skills/kb-content-style/SKILL.md) —— Claude Code 在写入 kb/ 时自动加载。核心要点：
- 保留 demo、Mermaid 优先、反抽象化
- 同主题聚合，文件内时间倒序
- 中文文件名 = frontmatter title
- 行数 >1000 关注 / >1500 必拆
- 章节编号必须从 1 连续无跳号
- 严禁"口头沉淀"（说"已沉淀"前必须 Read 验证文件存在）
```

- [ ] **Step 4: 修改「测试纪律（软 TDD）」段为索引**

找到 `### 测试纪律（软 TDD）` 段，替换为：

```markdown
### 测试纪律（软 TDD）

详见 [.claude/skills/kb-tdd-discipline/SKILL.md](.claude/skills/kb-tdd-discipline/SKILL.md) —— Claude Code 在修改 scripts/ 或 tests/ 时自动加载。核心要点：
- 错误趋向区域（marked 渲染、路径解析、frontmatter、lint 脚本）必须 TDD：先红后绿
- Bug 修复必须先在 tests/ 加复现 case
- 测试入口：`bash test.sh`
- pre-push hook 兜底：`bash scripts/install-hooks.sh` 安装
```

- [ ] **Step 5: 删除 backup（确认 CLAUDE.md 改对了）**

```bash
diff CLAUDE.md.bak CLAUDE.md
# 确认差异是预期的（删了大量内容、加了 3 处索引）
rm CLAUDE.md.bak
```

- [ ] **Step 6: 跑 arch-lint 验证（[11/13] 文档引用一致性会检查 skill 路径是否真实）**

Run: `bash scripts/arch-lint.sh 2>&1 | grep "11/13"`
Expected: `✓ 文档中引用的脚本/文件都存在`

注：arch-lint [11/13] 只检查 `scripts/` 和 `./` 路径，不会检查 `.claude/skills/`，所以路径正确性需要人工 verify。

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md
git commit -m "refactor: A3 part 4 CLAUDE.md 缩减为 skill 索引

Git 规则 → auto-commit-discipline skill 索引
笔记风格/拆分/章节/口头沉淀 → kb-content-style skill 索引
测试纪律 → kb-tdd-discipline skill 索引

CLAUDE.md 从 203 行降到约 110 行；
详细规则按场景自动加载，避免冷启动 attention 全扫漏规则。"
```

---

**G3 收尾**：
```bash
bash test.sh
bash scripts/arch-lint.sh
git push origin kb-uplift-g3-skills
```

---

## Group G4: 跨设备/协作（worktree: `kb-uplift-g4-sync`）

### Task 13: memory 双向 sync 脚本（A6）

**Files:**
- Create: `scripts/sync-memory.sh`
- Create: `.claude/memory-snapshot/` (目录)
- Create: `.claude/memory-snapshot/.allowlist`
- Create: `tests/sync-memory.test.js`

- [ ] **Step 1: 写失败测试**

新建 `tests/sync-memory.test.js`：

```javascript
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

function setupTwoSides() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-test-'));
  const sideA = path.join(root, 'memory-a');
  const sideB = path.join(root, 'memory-b');
  fs.mkdirSync(sideA, { recursive: true });
  fs.mkdirSync(sideB, { recursive: true });
  return { root, sideA, sideB };
}

function setMtime(file, secondsAgo) {
  const t = Date.now() / 1000 - secondsAgo;
  fs.utimesSync(file, t, t);
}

const scriptPath = path.resolve(__dirname, '..', 'scripts', 'sync-memory.sh');

test('sync-memory: 仅同步 allowlist 中的文件', () => {
  const { sideA, sideB } = setupTwoSides();
  fs.writeFileSync(path.join(sideA, 'allowed.md'), 'content from A');
  fs.writeFileSync(path.join(sideA, 'not-allowed.md'), 'should not sync');
  // allowlist only includes allowed.md
  const allowlistDir = path.join(sideB);
  fs.writeFileSync(path.join(allowlistDir, '.allowlist'), 'allowed.md\n');
  execSync(`bash "${scriptPath}" "${sideA}" "${sideB}"`, { encoding: 'utf-8' });
  assert.ok(fs.existsSync(path.join(sideB, 'allowed.md')), 'allowed.md 应同步');
  assert.ok(!fs.existsSync(path.join(sideB, 'not-allowed.md')), '不在白名单的不应同步');
});

test('sync-memory: mtime 较新者覆盖较旧者（A → B）', () => {
  const { sideA, sideB } = setupTwoSides();
  fs.writeFileSync(path.join(sideA, 'x.md'), 'A version (newer)');
  fs.writeFileSync(path.join(sideB, 'x.md'), 'B version (older)');
  setMtime(path.join(sideA, 'x.md'), 10);    // 10秒前
  setMtime(path.join(sideB, 'x.md'), 1000);  // 1000秒前
  fs.writeFileSync(path.join(sideB, '.allowlist'), 'x.md\n');
  execSync(`bash "${scriptPath}" "${sideA}" "${sideB}"`, { encoding: 'utf-8' });
  assert.equal(fs.readFileSync(path.join(sideB, 'x.md'), 'utf-8'), 'A version (newer)');
});

test('sync-memory: mtime 较新者覆盖较旧者（B → A）', () => {
  const { sideA, sideB } = setupTwoSides();
  fs.writeFileSync(path.join(sideA, 'y.md'), 'A version (older)');
  fs.writeFileSync(path.join(sideB, 'y.md'), 'B version (newer)');
  setMtime(path.join(sideA, 'y.md'), 1000);
  setMtime(path.join(sideB, 'y.md'), 10);
  fs.writeFileSync(path.join(sideB, '.allowlist'), 'y.md\n');
  execSync(`bash "${scriptPath}" "${sideA}" "${sideB}"`, { encoding: 'utf-8' });
  assert.equal(fs.readFileSync(path.join(sideA, 'y.md'), 'utf-8'), 'B version (newer)');
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/sync-memory.test.js`
Expected: `No such file`

- [ ] **Step 3: 实现 scripts/sync-memory.sh**

新建 `scripts/sync-memory.sh`：

```bash
#!/bin/bash
# sync-memory.sh — 双向同步 memory（mtime 较新者覆盖较旧者）
# 用法: bash scripts/sync-memory.sh [SIDE_A] [SIDE_B]
#   默认 SIDE_A: ~/.claude/projects/<repo>/memory
#   默认 SIDE_B: .claude/memory-snapshot
# 同步范围：受 SIDE_B/.allowlist 约束（每行一个文件名）
set -uo pipefail

cd "$(dirname "$0")/.."

PROJECT_DIR=$(pwd)
DEFAULT_A="$HOME/.claude/projects/$(echo "$PROJECT_DIR" | tr '/' '-')/memory"
DEFAULT_B=".claude/memory-snapshot"

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
while IFS= read -r name; do
  [ -z "$name" ] && continue
  [ "${name:0:1}" = "#" ] && continue  # 注释行
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
  # 两边都有：比较 mtime
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
```

```bash
chmod +x scripts/sync-memory.sh
```

- [ ] **Step 4: 初始化 .claude/memory-snapshot/ 目录 + allowlist**

```bash
mkdir -p .claude/memory-snapshot
# 把现有 memory 文件名列入 allowlist
ls ~/.claude/projects/-Users-xuhu-workspace-xuhuLocal-ans-ai-auto-notes/memory/*.md 2>/dev/null | xargs -n1 basename > .claude/memory-snapshot/.allowlist
# 首次跑 sync（A → B 全量初始化）
bash scripts/sync-memory.sh
```

- [ ] **Step 5: 跑测试确认通过**

Run: `node --test tests/sync-memory.test.js`
Expected: 3 个测试全 pass

- [ ] **Step 6: Commit**

```bash
git add scripts/sync-memory.sh tests/sync-memory.test.js .claude/memory-snapshot/
git commit -m "feat: A6 memory 双向 sync（snapshot 入 git + allowlist）

scripts/sync-memory.sh：mtime 较新者覆盖较旧者（rsync --update 语义）。
.claude/memory-snapshot/ 入 git 跟踪，.allowlist 控制同步范围。
首次跑同步现有 memory 文件到 snapshot。"
```

---

### Task 14: plan 系统集成（A7）

**Files:**
- Modify: `CLAUDE.md`
- Modify: `exit-check.sh`
- Create: `tests/plans-status.test.js`

- [ ] **Step 1: 写失败测试**

新建 `tests/plans-status.test.js`：

```javascript
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { listOpenPlans } = require('../scripts/list-open-plans.js');

function withTempPlans(plans, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plans-test-'));
  Object.entries(plans).forEach(([name, content]) => {
    fs.writeFileSync(path.join(dir, name), content);
  });
  try { fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('listOpenPlans: 识别 frontmatter status 字段', () => {
  withTempPlans({
    'a.md': '---\nstatus: 进行中\n---\n# A',
    'b.md': '---\nstatus: 已完成\n---\n# B',
    'c.md': '---\nstatus: 待开始\n---\n# C',
  }, dir => {
    const open = listOpenPlans(dir);
    const names = open.map(p => path.basename(p.file));
    assert.ok(names.includes('a.md'));
    assert.ok(!names.includes('b.md'));
    assert.ok(names.includes('c.md'));
  });
});

test('listOpenPlans: 识别 "> 状态: xxx" 段', () => {
  withTempPlans({
    'a.md': '# Plan\n> 状态: 进行中\n',
    'b.md': '# Plan\n> 状态: 已完成\n',
  }, dir => {
    const open = listOpenPlans(dir);
    assert.equal(open.length, 1);
    assert.equal(path.basename(open[0].file), 'a.md');
  });
});

test('listOpenPlans: 无 status 视为开放', () => {
  withTempPlans({
    'x.md': '# Plan\n无状态字段',
  }, dir => {
    const open = listOpenPlans(dir);
    assert.equal(open.length, 1);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/plans-status.test.js`
Expected: `Cannot find module '../scripts/list-open-plans.js'`

- [ ] **Step 3: 实现 scripts/list-open-plans.js**

新建 `scripts/list-open-plans.js`：

```javascript
#!/usr/bin/env node
/**
 * list-open-plans.js — 扫描 plans 目录，列出未完成的 plan
 *
 * 状态识别（按优先级）：
 *   1. frontmatter `status:` 字段
 *   2. `> 状态: xxx` markdown 引用段
 *   3. 都没有视为开放
 *
 * "已完成" 状态会被过滤掉；其他状态（进行中/待开始/未知）视为开放。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const CLOSED_STATES = new Set(['已完成', 'completed', 'done', 'closed']);

function extractStatus(content) {
  // frontmatter
  if (content.startsWith('---')) {
    const end = content.indexOf('---', 3);
    if (end > 0) {
      const yaml = content.substring(3, end);
      const m = yaml.match(/^status:\s*"?(.+?)"?\s*$/m);
      if (m) return m[1].trim();
    }
  }
  // > 状态: xxx
  const m = content.match(/^>\s*状态:\s*(.+)$/m);
  if (m) return m[1].trim();
  return '';
}

function listOpenPlans(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  const open = [];
  files.forEach(f => {
    const full = path.join(dir, f);
    const content = fs.readFileSync(full, 'utf-8');
    const status = extractStatus(content);
    if (!CLOSED_STATES.has(status.toLowerCase())) {
      open.push({ file: full, status: status || '(未知)' });
    }
  });
  return open;
}

function main() {
  const dir = process.argv[2] || path.resolve(__dirname, '..', 'docs', 'superpowers', 'plans');
  const open = listOpenPlans(dir);
  if (open.length === 0) {
    console.log('  ✓ 无进行中的 plan');
  } else {
    open.forEach(p => {
      console.log('  📋 ' + path.basename(p.file) + ' — 状态: ' + p.status);
    });
  }
}

if (require.main === module) main();

module.exports = { listOpenPlans, extractStatus };
```

- [ ] **Step 4: 跑测试通过**

Run: `node --test tests/plans-status.test.js`
Expected: 3 个测试全 pass

- [ ] **Step 5: 在 exit-check.sh 加 [9/9] plans 状态**

在 `exit-check.sh` 末尾、`echo "========== 退出检查完成 =========="` 前插入：

```bash
# [9/9] plans 状态汇总
echo ""
echo "[9/9] plans 状态汇总..."
node scripts/list-open-plans.js
```

把所有 `[N/8]` 改为 `[N/9]`：

```bash
sed -i '' 's|\[\([0-9]*\)/8\]|[\1/9]|g' exit-check.sh
```

- [ ] **Step 6: 在 CLAUDE.md 加 Plan 系统段**

打开 `CLAUDE.md`，在「会话退出检查」段之后追加：

```markdown
### Plan 系统

长期任务（跨多个 session 的实施项目）的 plan 位于 [`docs/superpowers/plans/`](docs/superpowers/plans/)。新 plan 通过 superpowers `writing-plans` skill 生成。Plan 文件 frontmatter 中 `status:` 字段或 `> 状态: xxx` 段标记进度。Stop hook 的 `[9/9]` 自动列出未完成 plan。
```

- [ ] **Step 7: Commit**

```bash
git add scripts/list-open-plans.js tests/plans-status.test.js exit-check.sh CLAUDE.md
git commit -m "feat: A7 plan 系统集成（复用 docs/superpowers/plans/）

scripts/list-open-plans.js：解析 frontmatter status 或 > 状态: 标记，
列出未完成的 plan。
exit-check.sh 加 [9/9] plans 状态汇总。
CLAUDE.md 加 Plan 系统段，复用 superpowers writing-plans 输出位置。"
```

---

### Task 15: bootstrap.sh + SETUP.md（B7）

**Files:**
- Create: `bootstrap.sh`
- Create: `SETUP.md`

- [ ] **Step 1: 实现 bootstrap.sh**

新建项目根 `bootstrap.sh`：

```bash
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
PROJECT_DIR=$(pwd)
MEM_DIR="$HOME/.claude/projects/$(echo "$PROJECT_DIR" | tr '/' '-')/memory"
mkdir -p "$MEM_DIR"
if [ -d ".claude/memory-snapshot" ]; then
  bash scripts/sync-memory.sh
  echo "  ✓ memory 已同步"
else
  echo "  ⚠️  .claude/memory-snapshot/ 不存在，跳过"
fi

# [5/6] 构建索引
echo ""
echo "[5/6] 构建 manifest.json + INDEX.md + timeline.json..."
node scripts/build-index.js
node scripts/build-timeline.js
echo "  ✓ 索引已构建"

# [6/6] 跑测试验证
echo ""
echo "[6/6] 跑测试验证..."
if bash test.sh; then
  echo "  ✓ 所有测试通过"
else
  echo "  ❌ 测试失败，bootstrap 未完全成功"
  exit 1
fi

echo ""
echo "========== Bootstrap 完成 =========="
echo ""
echo "下一步："
echo "  - 启动本地预览：./serve.sh"
echo "  - 开始用 Claude Code 在此项目工作"
echo ""
```

```bash
chmod +x bootstrap.sh
```

- [ ] **Step 2: 写 SETUP.md**

新建 `SETUP.md`：

```markdown
# SETUP — 新设备 onboarding

## 一键 bootstrap

```bash
git clone <this-repo>
cd ans-ai-auto-notes
bash bootstrap.sh
```

bootstrap.sh 会自动完成：
1. 探测 Claude Code 安装状态
2. 安装 git pre-push hook
3. 检查全局 ~/.claude/settings.json
4. 初始化 memory（从 `.claude/memory-snapshot/` 同步到 ~/.claude/projects/.../memory/）
5. 构建 manifest.json + INDEX.md + timeline.json
6. 跑测试验证

## 手动 setup（如 bootstrap 失败）

### 1. 安装 Claude Code

参考官方文档：https://docs.claude.com/claude-code

### 2. 安装 git hook

```bash
bash scripts/install-hooks.sh
```

### 3. 配置全局 settings

如果 `~/.claude/settings.json` 不存在，创建最小配置：

```json
{
  "theme": "dark"
}
```

### 4. 同步 memory

```bash
bash scripts/sync-memory.sh
```

### 5. 构建索引

```bash
node scripts/build-index.js
node scripts/build-timeline.js
```

### 6. 跑测试

```bash
bash test.sh
```

## FAQ

### Q: bootstrap 报"claude 命令未找到"

A: 先安装 Claude Code 再跑 bootstrap：https://docs.claude.com/claude-code

### Q: memory 同步只同步部分文件？

A: 同步范围由 `.claude/memory-snapshot/.allowlist` 控制。每行一个文件名。新增 memory 文件需手动加入 allowlist。

### Q: 跨设备同步流程？

A:
1. 设备 A 修改 memory → `bash scripts/sync-memory.sh` → push snapshot
2. 设备 B `git pull` → `bash scripts/sync-memory.sh` → 本地 memory 更新
```

- [ ] **Step 3: 跑 bootstrap.sh 自验**

```bash
bash bootstrap.sh
```
Expected: 6 步全 pass，最后输出 "Bootstrap 完成"

- [ ] **Step 4: Commit**

```bash
git add bootstrap.sh SETUP.md
git commit -m "feat: B7 bootstrap.sh + SETUP.md（新设备 onboarding）

bootstrap.sh 6 步：claude 探测 → install-hooks → 全局 settings 检查 →
memory sync → 构建索引 → 跑测试。
SETUP.md：人类可读的步骤说明 + 手动 fallback + FAQ。"
```

---

**G4 收尾**：
```bash
bash test.sh
bash exit-check.sh
git push origin kb-uplift-g4-sync
```

---

## Group G5: 编辑器辅助（worktree: `kb-uplift-g5-tools`）

### Task 16: split-doc 拆分助手（B2）

**Files:**
- Create: `scripts/split-doc.js`
- Create: `tests/split-doc.test.js`

- [ ] **Step 1: 写失败测试**

新建 `tests/split-doc.test.js`：

```javascript
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { splitDocBySections, sanitizeFilename } = require('../scripts/split-doc.js');

test('sanitizeFilename: 冒号→全角，去非法字符', () => {
  assert.equal(sanitizeFilename('A: B'), 'A：B');
  assert.equal(sanitizeFilename('A/B*C?D'), 'ABCD');
  assert.equal(sanitizeFilename('A   B'), 'A B');
});

test('splitDocBySections: 拆出指定章节为新文件', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'split-test-'));
  const big = path.join(dir, 'big.md');
  fs.writeFileSync(big, `---
title: Big
description: D
---

# Big

## 章节 A
内容 A

## 章节 B
内容 B

## 章节 C
内容 C
`);
  const result = splitDocBySections(big, ['章节 A', '章节 B']);
  // 应生成两个新文件
  assert.ok(fs.existsSync(path.join(dir, '章节 A.md')));
  assert.ok(fs.existsSync(path.join(dir, '章节 B.md')));
  // 原文件应只剩章节 C
  const orig = fs.readFileSync(big, 'utf-8');
  assert.ok(!orig.includes('## 章节 A\n内容 A'));
  assert.ok(!orig.includes('## 章节 B\n内容 B'));
  assert.ok(orig.includes('## 章节 C'));
  // 原文件应有拆分提示
  assert.ok(orig.includes('已拆分'));
  assert.ok(orig.includes('章节 A.md'));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('splitDocBySections: 章节名不匹配 -> 抛错', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'split-test-'));
  const big = path.join(dir, 'big.md');
  fs.writeFileSync(big, '# Big\n## 章节 A\n内容');
  assert.throws(
    () => splitDocBySections(big, ['不存在的章节']),
    /章节未找到/
  );
  fs.rmSync(dir, { recursive: true, force: true });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/split-doc.test.js`
Expected: `Cannot find module '../scripts/split-doc.js'`

- [ ] **Step 3: 实现 scripts/split-doc.js**

新建 `scripts/split-doc.js`：

```javascript
#!/usr/bin/env node
/**
 * split-doc.js — 半自动拆分 KB 大文件
 *
 * 用法: node scripts/split-doc.js <file.md> --sections "章节A,章节B"
 * 行为:
 *   1. parse <file.md>，按 h2 切割
 *   2. 抽出指定章节生成新文件（文件名 = sanitizeFilename(章节)，同目录）
 *   3. 原文件留拆分提示：> 已拆分到 [章节 A.md] (...)
 *   4. 自动跑 build-index 重建 INDEX
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function sanitizeFilename(name) {
  return String(name)
    .replace(/:/g, '：')
    .replace(/[\/\\*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// 把 md 按 ## 切段，返回 [{title, body, raw, startIdx, endIdx}]
function parseH2Sections(content) {
  const lines = content.split('\n');
  const sections = [];
  let current = null;
  let inCode = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line)) { inCode = !inCode; }
    if (!inCode) {
      const m = /^##\s(.+)$/.exec(line);
      if (m) {
        if (current) {
          current.endIdx = i - 1;
          sections.push(current);
        }
        current = { title: m[1].trim(), startIdx: i, endIdx: lines.length - 1, raw: '' };
        continue;
      }
    }
    if (current) {
      current.raw += line + '\n';
    }
  }
  if (current) sections.push(current);
  sections.forEach(s => {
    s.body = s.raw;  // body 不含 ## 标题行
    s.raw = '## ' + s.title + '\n' + s.body;
  });
  return sections;
}

function splitDocBySections(filePath, sectionTitles) {
  const dir = path.dirname(filePath);
  const content = fs.readFileSync(filePath, 'utf-8');
  // 分离 frontmatter
  let fm = '';
  let body = content;
  if (content.startsWith('---')) {
    const end = content.indexOf('---', 3);
    if (end > 0) {
      fm = content.substring(0, end + 3) + '\n\n';
      body = content.substring(end + 3).replace(/^\n+/, '');
    }
  }
  const sections = parseH2Sections(body);
  const titleSet = new Set(sections.map(s => s.title));
  // 验证章节存在
  for (const t of sectionTitles) {
    if (!titleSet.has(t)) {
      throw new Error('章节未找到: ' + t + '（可用：' + [...titleSet].join('，') + '）');
    }
  }
  // 生成新文件 + 收集要移除的章节
  const removed = new Set(sectionTitles);
  const newFiles = [];
  sectionTitles.forEach(t => {
    const sec = sections.find(s => s.title === t);
    const fname = sanitizeFilename(t) + '.md';
    const fpath = path.join(dir, fname);
    if (fs.existsSync(fpath)) {
      throw new Error('输出文件已存在: ' + fpath);
    }
    const newFm = '---\ntitle: "' + t + '"\ndescription: "从 ' + path.basename(filePath) + ' 拆出"\n---\n\n# ' + t + '\n\n' + sec.body;
    fs.writeFileSync(fpath, newFm);
    newFiles.push({ title: t, path: fpath });
  });
  // 重写原文件
  const remaining = sections.filter(s => !removed.has(s.title));
  let newBody = fm;
  // 在保留章节前插入拆分提示
  if (newFiles.length > 0) {
    newBody += '> 已拆分到：' + newFiles.map(f => '[' + f.title + '](./' + path.basename(f.path) + ')').join('、') + '\n\n';
  }
  newBody += remaining.map(s => s.raw).join('\n');
  fs.writeFileSync(filePath, newBody);
  return { newFiles, remaining: remaining.map(s => s.title) };
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 3 || args[1] !== '--sections') {
    console.error('用法: node scripts/split-doc.js <file.md> --sections "章节A,章节B"');
    process.exit(1);
  }
  const file = args[0];
  const sections = args[2].split(',').map(s => s.trim());
  const result = splitDocBySections(file, sections);
  console.log('已拆出 ' + result.newFiles.length + ' 个新文件：');
  result.newFiles.forEach(f => console.log('  ✓ ' + f.path));
  console.log('原文件保留 ' + result.remaining.length + ' 个章节');
  // 自动重建 INDEX
  console.log('重建 INDEX...');
  execSync('node scripts/build-index.js', { stdio: 'inherit' });
}

if (require.main === module) main();

module.exports = { splitDocBySections, sanitizeFilename, parseH2Sections };
```

- [ ] **Step 4: 跑测试通过**

Run: `node --test tests/split-doc.test.js`
Expected: 3 个测试全 pass

- [ ] **Step 5: Commit**

```bash
git add scripts/split-doc.js tests/split-doc.test.js
git commit -m "feat: B2 拆分助手 split-doc.js

用法: node scripts/split-doc.js <file.md> --sections \"章节A,章节B\"
按 h2 切割 → 抽出指定章节生成新文件 → 原文件留拆分链接 → 重建 INDEX。
文件名遵循中文规则（冒号→全角，去非法字符）。"
```

---

### Task 17: 决策 ADR（B5）

**Files:**
- Create: `docs/decisions.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: 新建 docs/decisions.md 含 1-2 条种子 ADR**

```markdown
# Architecture Decision Records (ADR)

> 项目内重大架构决策、分类争议的归档。新决策追加 ADR，编号单调递增。
> 用途：让 AI 在分类摇摆或架构选择时有先例可循，避免目录漂移。

---

## ADR-001: AI 子树拆 5 个子目录（基础/大模型/Claude-Code/AI-Coding/应用）

- **日期**: 2026-05 起
- **状态**: 接受
- **背景**: kb/技术/AI/ 内容快速膨胀，单层 AI 目录文件数 >15，混合多个子领域
- **选项**:
  - (a) 保持单层（按 frontmatter tag 分组）
  - (b) 拆 2 个子目录（基础 / 应用）
  - (c) 拆 5 个并列子目录（基础/大模型/Claude-Code/AI-Coding/应用）
- **决定**: (c)
- **理由**:
  - 5 个子领域边界清晰，每个 ≥3 文件
  - 物理目录拆分（user feedback: physical-structure-over-metadata）
  - manifest + INDEX 由 build-index 自动生成，目录就是分类

## ADR-002: timeline.json 改为构建产物（仅自动化 JSON，md 保留手维护）

- **日期**: 2026-06-01
- **状态**: 接受
- **背景**: timeline.json 手维护是负担，但 timeline/*.md 含人类叙事性内容
- **选项**:
  - (a) 两者都自动化
  - (b) 仅自动化 timeline.json，timeline/*.md 保留
  - (c) 反过来，timeline/*.md 才是源，JSON 从 md 生成
- **决定**: (b)
- **理由**:
  - JSON 可机器生成（git log + frontmatter 已含所需信息）
  - md 的"为什么改 / 感悟"是人类才能写的
  - 渐进式自动化优于一次性大改

---

## 新 ADR 模板

```markdown
## ADR-NNN: <短标题>

- **日期**: YYYY-MM-DD
- **状态**: 接受 / 已替换（被 ADR-XXX 替代） / 已弃用
- **背景**: <为什么需要决策>
- **选项**:
  - (a) ...
  - (b) ...
- **决定**: <选了哪个>
- **理由**: <为什么>
```
```

- [ ] **Step 2: 在 CLAUDE.md 加 ADR 索引段**

打开 `CLAUDE.md`，在「跨文件关联规则」段之后追加：

```markdown
### 决策先例（ADR）

遇到分类歧义或重大架构决策时，先看 [`docs/decisions.md`](docs/decisions.md)。如果是新的争议点，决策后追加 ADR（编号单调递增）。这帮助 AI 在分类摇摆时有先例可循，避免目录漂移。
```

- [ ] **Step 3: Commit**

```bash
git add docs/decisions.md CLAUDE.md
git commit -m "feat: B5 ADR 决策先例文档

新建 docs/decisions.md（ADR 风格），含 2 条种子：
- ADR-001: AI 子树 5 子目录划分
- ADR-002: timeline.json 改为构建产物

CLAUDE.md 加索引段：遇分类歧义先看 decisions.md。"
```

---

**G5 收尾**：
```bash
bash test.sh
bash exit-check.sh
git push origin kb-uplift-g5-tools
```

---

## 集成与验收

### ⚠️ 集成前必修（G3 self-review 发现的 forward reference）

G3 worktree 内的 `.claude/skills/auto-commit-discipline/SKILL.md` 末尾「与其他 skill / hook 的关系」段引用了：

- `exit-check.sh [7/8]` —— 但 G3 worktree 中 exit-check 仍是 `[N/7]`（G2 才把它改成 `[N/8]` 然后 G4 再改成 `[N/9]`）
- `verify-claim.sh (PostToolUse hook)` —— G2 才创建，G3 worktree 不存在

**集成 G2 之后**（最早能修的时机），需要打开 `.claude/skills/auto-commit-discipline/SKILL.md` 把这两行的具体编号 / 文件名改对：
- `exit-check.sh [7/8]` → 若 G4 也合入，改为 `[7/9]`；否则 `[7/8]`
- `verify-claim.sh` 验证存在后保留即可

或者更稳妥：在 skill 里用通用写法去掉具体编号引用（参考 `kb-content-style` skill 章节编号段的写法 "由 arch-lint.sh 章节编号连续性检查自动兜底"）。

另外 G2/G4 集成时可能还需要给 `.gitignore` 加 `!.claude/settings.local.json` 例外（G3 worktree 已经把 `.claude/` 改为 `.claude/* + !.claude/skills/`，但 settings.local.json 仍被排除）。

### Task 18: 5 worktree 串行 rebase + merge

**执行者**: 主仓 main 分支（不在任何 worktree 内）

- [ ] **Step 1: 回到主仓 main**

```bash
cd /Users/xuhu/workspace/xuhuLocal/ans-ai-auto-notes
git checkout main
git pull origin main
```

- [ ] **Step 2: 按 G1→G2→G3→G4→G5 顺序集成**

```bash
# G1
git checkout kb-uplift-g1-data
git rebase main
git checkout main
git merge --ff-only kb-uplift-g1-data
bash test.sh && bash scripts/arch-lint.sh
git push origin main
```

```bash
# G2 — 注意 arch-lint.sh 冲突（G1 加 14/14 anchor，G2 加 15/15 内容质量）
git checkout kb-uplift-g2-hook
git rebase main
# 可能冲突：scripts/arch-lint.sh
# 解决：G1 已经把 13 → 14（arch-lint 编号），G2 在 14 基础上再 → 15
# 手动确认所有 [N/15] 编号正确
git checkout main
git merge --ff-only kb-uplift-g2-hook
bash test.sh && bash scripts/arch-lint.sh
git push origin main
```

```bash
# G3 — 注意 CLAUDE.md 大改（缩减）
git checkout kb-uplift-g3-skills
git rebase main
git checkout main
git merge --ff-only kb-uplift-g3-skills
bash test.sh && bash scripts/arch-lint.sh
git push origin main
```

```bash
# G4 — 注意 .claude/settings.local.json 冲突（G2 加 PostToolUse，G4 加 hook）
git checkout kb-uplift-g4-sync
git rebase main
# 手动合并 settings.local.json hooks 段
git checkout main
git merge --ff-only kb-uplift-g4-sync
bash test.sh && bash scripts/arch-lint.sh
git push origin main
```

```bash
# G5
git checkout kb-uplift-g5-tools
git rebase main
# 可能冲突：CLAUDE.md（G3 缩减 + G4 加 plan 段 + G5 加 ADR 段）
git checkout main
git merge --ff-only kb-uplift-g5-tools
bash test.sh && bash scripts/arch-lint.sh
git push origin main
```

- [ ] **Step 3: 跑全量测试 + 全量 lint**

```bash
bash test.sh
bash scripts/arch-lint.sh
bash exit-check.sh
```
Expected: 测试全绿、arch-lint 无错误（警告可接受）、exit-check 干净

- [ ] **Step 4: 删除 worktree（可选）**

```bash
git worktree remove kb-uplift-g1-data
git worktree remove kb-uplift-g2-hook
git worktree remove kb-uplift-g3-skills
git worktree remove kb-uplift-g4-sync
git worktree remove kb-uplift-g5-tools
git branch -d kb-uplift-g1-data kb-uplift-g2-hook kb-uplift-g3-skills kb-uplift-g4-sync kb-uplift-g5-tools
```

---

### Task 19: fresh bootstrap 验证 + 写一条 ADR

**Files:**
- Modify: `docs/decisions.md`

- [ ] **Step 1: 模拟 fresh setup（在临时目录 clone）**

```bash
TEMP=$(mktemp -d)
git clone $(pwd) $TEMP/ans-ai-auto-notes
cd $TEMP/ans-ai-auto-notes
bash bootstrap.sh
```
Expected: bootstrap 6 步全 pass

- [ ] **Step 2: 启动 serve.sh 验证搜索 + 反向链接**

```bash
./serve.sh &
sleep 2
open http://localhost:8765
```

手动检查：
- [ ] 搜索框出现，输入"agent"能搜到匹配项
- [ ] 进入一个被多文件引用的页面，底部有"📎 被以下文件引用"

```bash
# 验证完毕清理临时目录
kill %1
cd /Users/xuhu/workspace/xuhuLocal/ans-ai-auto-notes
rm -rf $TEMP
```

- [ ] **Step 3: 加一条 ADR 记录本次升级**

打开 `docs/decisions.md`，在最后追加：

```markdown
## ADR-003: KB 系统升级 13 项（数据/Hook/规则/同步/编辑器）

- **日期**: 2026-06-01
- **状态**: 接受
- **背景**: 2026-06-01 audit 暴露多个结构性问题：AI 漏规则、session-log 利用率近零、timeline 手维护、跨设备 onboarding 缺失等
- **选项**:
  - (a) 修补单点（每次发现一个问题改一个）
  - (b) 整体规划 13 项分 5 组并行实施
- **决定**: (b)
- **理由**:
  - 单点修补会让规则碎片化
  - 5 组边界清晰且独立，可并行 worktree
  - 集成顺序 G1→G5 利用依赖关系
- **关联**: [spec](superpowers/specs/2026-06-01-kb-system-uplift-design.md) | [plan](superpowers/plans/2026-06-01-kb-system-uplift-plan.md)
```

- [ ] **Step 4: Commit**

```bash
git add docs/decisions.md
git commit -m "docs: ADR-003 记录 KB 系统升级 13 项的整体决策

dogfood B5：用 ADR 记录本次升级本身的决策过程。
关联 spec 和 plan 文件。"
git push origin main
```

- [ ] **Step 5: 最终检查**

```bash
bash test.sh
bash scripts/arch-lint.sh
bash exit-check.sh
git status
git log --oneline -10
```

Expected:
- test.sh 全绿
- arch-lint.sh 错误 = 0（警告可接受）
- exit-check.sh 干净
- git status clean
- 最近 commit 含 G1-G5 各组 + 集成 + ADR-003
