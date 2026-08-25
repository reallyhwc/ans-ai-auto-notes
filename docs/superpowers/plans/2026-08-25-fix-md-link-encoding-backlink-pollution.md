---
title: "修复 md 链接编码/尖括号解析缺陷导致的 backlink 图污染与测试门禁破防"
status: open
created: 2026-08-25
scope: Correctness（链接解析正确性）
author: main agent（综合 Correctness / Security / Tests 三成员审查）
---

# 修复 md 链接编码/尖括号解析缺陷

> 状态: open（待 fix 小队执行，本方案仅设计，未修改任何源码）
> 关联: 前一版本审阅发现见 docs/decisions.md 相关 ADR（如已补）

## 0. 一句话结论

`scripts/` 的链接解析（`build-index.js extractLinks` + `lib.js resolveRelativeMd`）假设「链接是无编码的 `](./x.md)` 形式」，而中文知识库的真实链接天然含空格/中文、需 `](<...>)` 尖括号包裹或 `%20` 编码。触发文件 `kb/技术/AI/AI-Coding/DSH（DeepSeek Harness）插件架构与循环调度.md` line 10（commit `bbaab5c`，已入库）混用了三种风格，导致：**manifest.json 的 backlinks 已含 4 个坏 key**（反向链接面板漏链）+ **`integration.test.js` 2 条断言真实失败却已入库**（门禁被击穿）。根因是「内容违规」与「代码缺陷」的双重问题，必须**两者都修**。

## 1. 问题清单（已实证，非推断）

| # | 问题 | 证据 |
|---|------|------|
| B1 | `DSH...md` line 10 的 `Claude Code 整体架构 & 工作流程` 链接含**真空格+`&`**、未编码未包裹 → marked/CommonMark 渲染时是**真死链** | `integration.test.js:52` 失败，明确列出 |
| B2 | 同 line 10 有 3 处 `%20` 编码但未 `<...>` 包裹的链接 → backlink 图污染（manifest 里 3 个 `%20` key + 1 个 `<./` key） | manifest.json 实测 `backlinks` 30 条中 4 条坏 key |
| B3 | `integration.test.js` 2 条断言失败，且 `bbaab5c` 已入 HEAD、`git status` 干净 → CI 门禁破防未拦 | `node --test tests/integration.test.js` 报 2 failures |
| B4 | `check-anchors.js` 锚点存活检查对 `](<...>)` 形式真实锚点是**空操作**（正则 `\]\((\\.{0,2}\\/[^)]*\\.md)#([^)]+)\)` 遇 `<` 不匹配）→ `arch-lint [14/15]` 假通过 | `check-anchors.js:53` 实测匹配数 0 |
| B5 | `resolveRelativeMd` 有 **3 个调用点**（backlink / renderKbLink 渲染 / check-anchors 锚点），修它会影响渲染与锚点校验，改动需精确 | `lib.js:100` `build-index.js:84` `check-anchors.js:58` |

> 关联但**不在本方案**范围（由 Tests/Security 成员单独报告，建议另立 plan 或同批修）：
> - **test.sh 假绿**：`node --test | tail` 尾管道吞 exit code，node 缺失仍 exit 0（Tests P0）——这是 B3「门禁没拦」的可疑根因，**fix 前 `bash test.sh` 的 gate 不可信**。
> - **Security XSS**：`app.js:420` escapeHtml→escapeAttr 等（Security 6 项，独立维度）。

## 2. 根因链

```
DSH...md:10 的 "> 关联:" 混用三种链接风格
   ├─ "../Claude-Code/Claude Code 整体架构 & 工作流程.md"  ← 真空格+&（B1 渲染死链）
   ├─ "../Claude-Code/Harness Engineering：...md"          ← %20 未包裹
   └─ "AI 编程工具：...md"                                  ← %20 未包裹（B2 backlink 污染）
        ↓
extractLinks(build-index.js:60) 的 mdLinkRe = /\]\(([^)]+\.md)(?:#[^)]*)?\)/g
   ├─ 捕获 %20 链接 → resolveRelativeMd 不解码 → key 保留 %20（B2）
   ├─ 对 ](<...>) 尖括号包裹【不捕获】→ 合法链接漏进 backlink（加重 B2）
   └─ 旧正则 [^)]+ 会捕获 "<" 残留 → 产生 "<./..." 坏 key（B2）
        ↓
resolveRelativeMd(lib.js:66) 不解码 %20、不剥离 <>
        ↓
integration.test.js:31/52 → 失败（B3）；check-anchors 漏检（B4）
```

**双缺陷**：
- **D1（内容侧）**：无机械约束强制「含空格/`&` 的 `.md` 链接必须 `](<...>)` 包裹」，违规可复发。
- **D2（代码侧）**：`extractLinks`/`resolveRelativeMd` 对 `%20` 不解码、对 `<...>` 既不支持也不剥离。

## 3. 修复目标

- **G1**：DSH 笔记 line 10 违规链接修规范 → `integration.test.js` 转绿。
- **G2**：`build-index.js`/`lib.js` 统一支持「裸链接、`%20`、`](<...>)`」三种形态，`%20` 正确解码、`<`/`>` 正确剥离 → backlink key 与磁盘路径一致。
- **G3**：重建 manifest → 清掉 4 个坏 key，反向链接恢复。
- **G4（防复发）**：违规可被机械约束前置捕获，而非事后测试。

## 4. 改动清单（精确到文件/函数/行）

### 4.1 内容侧（最小修复，必改）

**文件**：`kb/技术/AI/AI-Coding/DSH（DeepSeek Harness）插件架构与循环调度.md` **line 10**

三种链接统一为 `](<...>)`（尖括号内用**原始空格**，不用 `%20`）：

```
改前: [Claude Code 整体架构 & 工作流程](../Claude-Code/Claude Code%20整体架构%20&%20工作流程.md) — … | [Harness Engineering](../Claude-Code/Harness%20Engineering：AI%20Agent%20时代的工程范式.md) — … | [AI 编程工具全景对比](AI%20编程工具：CLI%20Agent%20与%20GUI%20IDE%20全景对比.md) — …
改后: [Claude Code 整体架构 & 工作流程](<../Claude-Code/Claude Code 整体架构 & 工作流程.md>) — … | [Harness Engineering](<../Claude-Code/Harness Engineering：AI Agent 时代的工程范式.md>) — … | [AI 编程工具全景对比](<AI 编程工具：CLI Agent 与 GUI IDE 全景对比.md>) — …
```

### 4.2 代码侧（根本修复，必改）

**文件**：`scripts/build-index.js`，`extractLinks`（约 line 60-76）

- `mdLinkRe` 需同时匹配「裸链接」与「尖括号包裹链接」，捕获后剥离首尾 `<`/`>`：
  ```js
  // 旧: /\]\(([^)]+\.md)(?:#[^)]*)?\)/g
  // 新: 允许 url 前有 < 包裹
  const mdLinkRe = /\]\((<[^>]+>|[^)\s]+\.md)(?:#[^)]*)?\)/g;
  // 捕获后: url = url.replace(/^<|>$/g, '')
  ```

**文件**：`scripts/lib.js`，`resolveRelativeMd`（约 line 66-81）

- **处理顺序（严格）**：切 `#` 锚点 → 剥 `<>` → decode 路径段 → split。
  ```js
  // 1) 切锚点（已有 anchorIdx 逻辑保留）
  // 2) hrefStr = hrefStr.replace(/^</, '').replace(/>$/, '')
  // 3) pathPart = decodeURIComponent(pathPart)  // 或最小方案: pathPart.replace(/%20/g, ' ')
  ```

> ⚠️ decode 顺序错（先于切锚点）会误伤 `%23` 锚点与合法 `%` 文本，见 R1/R2。

### 4.3 防复发（机械约束，建议）

**文件**：`scripts/arch-lint.sh`（**不是** `verify-claim.sh`，见 Security 意见：应做全量跨文件扫描，而非单文件 PostToolUse）

- 把 `integration.test.js:52` 的「含空格/`&` 的 `.md` 链接必须 `<...>` 包裹」逻辑下沉为前置扫描项：凡 `](` 后 url 含真空格/`&` 且不以 `<` 开头 → 报错。

### 4.4 重建 + 验证

**文件**：`manifest.json`（**生成物，纯 `node scripts/build-index.js` 重建，禁止 Write/Edit 手改**）

## 5. 逻辑正确性风险（方案层必须声明）

| 风险 | 说明 | 缓解 |
|------|------|------|
| R1 | `decodeURIComponent` 对已含合法 `%` 的文件名会抛 `URIError` | 最小方案：`hrefStr.replace(/%20/g, ' ')`（不全面 decode，最稳）；或 try/catch |
| R2 | 剥尖括号误伤「链接文本含 `>`」 | 只剥**首尾** `^<` `>$`，不处理中间 |
| R3 | 新 `mdLinkRe` 若改窄漏匹配「锚点后有空格」边缘 | 保留 `(?:#[^)]*)?` 锚点分支，回归重点看含锚点链接 |
| R4 | `resolveRelativeMd` 有 3 调用点，改动波及**渲染(renderKbLink)** 与**锚点校验(check-anchors)** | 见 §7 验证，三处都要回归 |
| R5 | 改 DSH 笔记内容 → 需重跑 `arch-lint [5/15]` CLAUDE.md↔磁盘一致性 | 验证步骤含全量 `bash test.sh` |

## 6. 安全约束（Security 成员意见，必遵守）

1. **重建 manifest 走 `node scripts/build-index.js`**（脚本式 fs 写入，不经 Write/Edit 工具，不会被 `pretool-guard`(仅拦 Write|Edit|NotebookEdit) 误拦）。**禁止**用 Write/Edit 手改 `manifest.json`/`INDEX.md`/`overview.html`。
2. **DSH 笔记 line 10 是普通源文件**，不在 `pretool-guard` 拦截名单，改它安全，但会被 `verify-claim`（PostToolUse）盯防——写完即校验实存，正常。
3. **manifest.json 实际非 git-tracked**（`git ls-files manifest.json` = 0，`.gitignore:46` 已忽略）。**故不存在 "shadow-tracked" 问题**，重建后无 git diff 污染，方案比预期更简单。（主 Agent 补齐 Correctness/Security 的未决项）
4. decode 顺序严格「切# → 剥<> → decode → split」，避免 FS 路径被解码产物污染。

## 7. 验证步骤（TDD 先红后绿）

1. **红（基线）**：`bash test.sh` → 确认 `integration.test.js` 2 条失败仍在。
   > ⚠️ 因 `test.sh` 假绿（Tests P0），**不要信 `bash test.sh` 的 exit 0**；用显式 node 路径验证：`/opt/homebrew/bin/node --test tests/integration.test.js`（先 `which node` 确认可用 node）。
2. **改 DSH 笔记 line 10** → `node --test tests/integration.test.js` → 2 条断言转绿。
3. **改 `build-index.js` + `lib.js`** → `node --test tests/build-index.test.js tests/lib.test.js tests/backlinks.test.js tests/search.test.js`（search 因 resolveRelativeMd 复用需补挂）。
4. **重建** `node scripts/build-index.js` → grep 确认 4 个坏 key 消失（`%20`、`<` 的 backlink key 不再出现），且 DSH 笔记 3 条出链**出现在**各自目标笔记的 backlinks。
5. **全量回归**：`node --test`（全目录）→ 0 fail；`bash lint.sh`；`node scripts/check-overview.js`；`bash scripts/arch-lint.sh`（15 项全过）；`bash scripts/check-anchors.js`。
6. **渲染抽查**：serve 后 overview.html「被引用」面板，确认 `Harness Engineering...md` 反向链接出现来自 `Claude Code 进阶工作流...md` 的入链。

## 8. 验收断言与 Gate 清单（Tests 成员设计）

- **内容侧 G1**：`integration.test.js` 两断言 0 失败。
- **代码侧 G2**：新增单测证明 `extractLinks` 能捕获 `](<...>)`、`resolveRelativeMd` 能解码 `%20` 并剥 `<>`。
- **重建 G3**：manifest.backlinks 无 `%20`/`<` 坏 key，30 条 key 全部与磁盘路径一致。
- **Gate**：
  - G-1 `node --test`（显式 node，绕过 test.sh 假绿）
  - G-2 `bash lint.sh`
  - G-3 `node scripts/check-overview.js`
  - G-4 死链测试（integration linkRe 升级后仍过）
  - G-5 `bash scripts/arch-lint.sh`（15 项）
  - G-6 manifest 无污染残留

**5 项回归风险点（Tests R-A~R-E，先红后绿）**：

| 风险 | 说明 | 落点 | 转绿断言 |
|------|------|------|----------|
| R-A | backlink 图 `%20`/尖括号污染 | tests/backlinks.test.js | 先红证明 extractLinks 不捕获 `](<...>)`，修复后转绿 |
| R-B | `resolveRelativeMd` 3 调用点波及 | tests/lib.test.js + search.test.js + check-anchors 相关 | 渲染/搜索/锚点三处回归全过 |
| R-C | integration.test.js 2 断言 | tests/integration.test.js | 内容改后转绿 |
| R-D | decode 顺序（切#→剥<>→decode→split） | tests/lib.test.js | 锚点 `%23` 不误删、合法 `%` 文本不抛 URIError |
| R-E | verify-claim/arch-lint 防复发约束 | tests/arch-lint.test.js | 新扫描项能拦「未包裹含空格链接」 |

## 9. 缺口（本轮已由主 Agent 补齐）

1. ~~backlinks schema 语义~~ → **已确认**：`backlinks = { 目标文件路径: [来源文件路径数组] }`，共 30 条、4 条坏 key。
2. ~~resolveRelativeMd 调用面~~ → **已确认 3 处**：`build-index.js:84`(backlink)、`lib.js:100`(renderKbLink 渲染)、`check-anchors.js:58`(锚点校验)。
3. ~~integration.test.js:35 linkRe 是否联动升级~~ → **是**，`linkRe`(line 35) 与 `badLinkRe` 均不支持 `](<...>)`，需同步升级为「可选 `<` 包裹」，否则死链检查对新规范有盲区。
4. ~~manifest.json shadow-tracked 处置~~ → **不成立**，manifest.json 非 git-tracked（`.gitignore:46`），重建无 diff 污染。

## 10. 本方案边界

- **仅 Correctness 维度**（链接解析正确性）。
- **不在本方案**：`test.sh` 假绿（Tests P0，建议同批修否则 gate 不可信）、Security XSS（app.js）、harness 配置漂移（`.claude` vs `.codex`、双指令源）。
- 本方案**未修改任何源码/内容/生成物**，仅供 fix 小队执行。
