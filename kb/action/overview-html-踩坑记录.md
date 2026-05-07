# overview.html 维护踩坑记录

> 最后整理: 2026-05-04 | 来源: 多轮对话排错

## 一句话定位

overview.html 是知识库的可视化导览页，通过嵌入式 KB_DATA（JS 对象）存储所有 .md 文件的完整内容。维护过程中踩过的坑记录在此，避免重复翻车。

---

## 1. JS 语法错误会静默炸掉整个页面

**现象**：打开 overview.html，侧栏可见但点击任何 tab/文件都无反应，页面完全空白。

**根因**：KB_DATA 的两个文件条目（"Prompt 与 RAG"、"Agent 与 MCP"）被误放在了 `buildFileIndex()` 函数体内部。`<script>` 标签中的任何 JS 语法错误都会导致整个脚本解析失败——浏览器不执行任何 JS，所有交互（tab 切换、文件点击、搜索）全部失效。

**教训**：
- 任何对 overview.html 的修改后，必须跑 `node --check`（需先提取 JS 到 `.js` 文件，因为 node 不识别 `.html` 后缀）
- 不要在手工编辑 HTML 中的 JS 时凭感觉操作——写脚本做替换，脚本本身也要验证

**检测方法**：
```bash
sed -n '/<script>/,/<\/script>/p' overview.html | sed '1d;$d' > /tmp/check.js
node --check /tmp/check.js
```

---

## 2. content 字段缺失 → 文件静默不可点击

**现象**：分类导览中文件列表正常显示，但部分文件名是纯文本（不可点击），其他文件可点击。

**根因**：`renderCategories()` 和 `viewContent()` 都检查 `file.content` 是否存在：

```javascript
// renderCategories 中：
if (path && file.content) {
  // 生成可点击的 span
} else {
  // 生成纯文本 span —— 不可点击！
}

// viewContent 中：
if (!file || !file.content) return;  // 静默返回，什么都不做
```

在清理"误入函数体"的条目时，把 AI 分类的 files 数组从 4 个带 `content` 的条目缩减为 3 个不带 `content` 的条目——文件名还在，但变成了纯文本。

**教训**：KB_DATA 中每个 file 条目要么不写（不在 files 数组里），要写就必须带完整 `content`。不存在"显示文件名但不提供内容"的中间状态。

---

## 3. .md 更新后 HTML 嵌入内容不会自动同步

**现象**：llm.md 拆分为 3 个文件时，cnn.md、rnn.md、transformer.md 末尾追加了交叉引用链接。但 overview.html 中嵌入的是旧版内容（缺少这些链接）。

**根因**：overview.html 的 KB_DATA 是 .md 内容的**一次性快照**，不是实时读取。因为 `file://` 协议下 `fetch()` 被 CORS 阻止，只能将内容嵌入到 `<script>` 标签中。

**教训**：
- 任何修改 .md 文件的操作后，必须同步更新 overview.html 中对应的嵌入内容
- 校验脚本需要用 `vm.runInContext` 解析 KB_DATA 后与 .md 原文比对，而不是做简单的字符串查找（因为 JSON 转义会导致 false positive）

**当前嵌入文件清单（8 个）**：
- kb/技术/java/spring-ai.md
- kb/技术/ai/cnn.md
- kb/技术/ai/rnn.md
- kb/技术/ai/transformer.md
- kb/技术/ai/llm.md
- kb/技术/ai/llm-prompt-rag.md
- kb/技术/ai/llm-agent-mcp.md
- kb/读书笔记/我看见的世界.md

---

## 4. 内容一致性校验的正确做法

**错误做法**：用 `String.indexOf()` 在 HTML 源码中搜索 .md 文件内容 → 因为 HTML 中 `"` 被转义为 `\"`、换行被转义为 `\n`，100% 误报。

**正确做法**：
```javascript
// 1. 用 vm.runInContext 解析 KB_DATA（自动处理 JS 转义）
const KB_DATA = /* 从 HTML 中提取并解析 */;

// 2. 比对解析后的内容与 .md 原文
const embeddedContent = findFileInKB(KB_DATA, path).content;
const mdContent = fs.readFileSync(path, 'utf-8');
if (mdContent !== embeddedContent) {
  // 确实不一致，修复
}

// 3. 修复时，用 JSON.stringify 转义新内容，然后在 HTML 源码中定位并替换
const oldEscaped = JSON.stringify(oldContent).slice(1, -1);
const newEscaped = JSON.stringify(mdContent).slice(1, -1);
htmlSource = htmlSource.replace(oldEscaped, newEscaped);
```

---

## 5. 本次会话修复摘要

| 问题 | 根因 | 修复 |
|------|------|------|
| 页面点击无反应 | 两个文件条目误入 `buildFileIndex()` 函数体 | 删除错误条目，修复括号结构 |
| LLM/Prompt/Agent 不可点击 | KB_DATA 条目缺少 `content` 字段 | 重新注入 3 个文件的完整内容 |
| cnn/rnn/transformer 内容过期 | .md 追加交叉链接后未同步 HTML | 重新注入 3 个文件的当前内容 |
| 自动记录笔记遗漏 | 多轮 QA 后未主动提取知识 | 写入 feedback memory，后续会话遵循 |

---

## 6. FILE_INDEX 结构升级三层后，4 个遍历函数全部翻车（2026-05-07）

**背景**：commit `7463507` 把 `kb/技术/ai/` 从两层平铺重构为「基础/大模型/应用生态」三层后，用户反馈"AI/机器学习 菜单下没内容"。

**深挖过程发现 4 处独立 bug**，全是同一个根因——遍历 FILE_INDEX 的代码硬编码了两层 `forEach`：

| # | 函数 | 症状 | 修复 |
|---|------|------|------|
| 1 | `renderCategories()` | 三层结构里的文件不渲染（用户最初报的 bug） | 抽出 `renderNode(node, idPrefix)` 递归 |
| 2 | `buildFileIndex()` | 三层文件能渲染但**点了无反应**（viewContent 找不到就 silent return） | 改成 `walk(node)` 递归 |
| 3 | `searchKB()` | 三层结构里的文件搜不到（预防性发现，用户没报） | 改成 `walk(node, pathSegs)` 递归，displayPath 用完整层级 |
| 4 | `checkServer()` | 用 `fetch('kb/技术/ai/llm.md', {method:'HEAD'})` 探测，但这个文件已被移动到 `大模型/llm.md` → 404 → 误判服务器不可用 → 首次进入提示"需要 HTTP 服务器" | 探测路径改为更稳定的 `INDEX.md` |

**关键教训**：

> **当 FILE_INDEX 结构升级时，一个 grep 全扫**：
> ```bash
> grep -n 'FILE_INDEX' overview.html
> ```
> 把所有遍历它的函数找出来，逐一确认是否需要同步升级。本次第 1 个 bug 修完后就停了，结果用户点击 → 报 #2 → 修完搜索 → 又是 #3 → 改完打开页面 → 又是 #4。**4 处都是独立症状但同一类根因，第一次就该一并修干净。**

**自动化检测**：本次踩坑后沉淀了 `scripts/check-overview.js`，5 项检查中有专门一项"buildFileIndex/searchKB/renderCategories 三者输出一致性"，下次类似问题会被自动捕获。`exit-check.sh` 也已扩展为在退出前调用此脚本。

**验证方法升级**（针对历史第 4 节"内容一致性校验"）：

之前的 `node --check` 只能验证 JS 语法。本次踩坑发现：**语法对的代码也可能逻辑不一致**（4 个函数语法都对，但语义不一致）。改进版断言（已固化在 `scripts/check-overview.js`）：

```js
// 取 buildFileIndex() 的所有 path 作为基准
const allPaths = Object.keys(buildFileIndex());

// 断言 1: renderCategories HTML 含每个 path
for (const p of allPaths) assert(renderHtml.indexOf(p) !== -1);

// 断言 2: searchKB 用 title 关键词能命中每个 path
for (const p of allPaths) {
  const kw = idx[p].title.replace(/\s+/g, '').slice(0, 2).toLowerCase();
  assert(searchKB(kw).some(r => r.filePath === p));
}

// 断言 3: 每个 path 对应的物理 md 文件真实存在
for (const p of allPaths) assert(fs.existsSync(p));
```

**临时验证脚本不要 commit**：本次踩坑还附带教训——`.tmp-verify-*.js` 残留在 git 暂存区里（AD 状态：add 后 delete，索引仍持有），是因为我用 `delete_file` 失败后改用 `rm -f`，没及时 `git rm --cached`。`scripts/check-overview.js` 已加入"git 暂存区不允许有 `.tmp-*` 文件"检查，下次会被自动拦截。

---

## 7. FILE_INDEX 路径过期 + viewContent 静默失败（2026-05-07）

**现象**：用户反馈"时间线里 CNN/RNN/Transformer 链接点不进去"、"搜索 LLM 部分链接可点部分不可点"。

**根因调查（systematic-debugging Phase 1）**：

| 检查 | 结果 |
|------|------|
| `curl -I http://localhost:8765/kb/技术/ai/cnn.md` | 404 |
| `curl -I http://localhost:8765/kb/技术/ai/基础/cnn.md` | 200 |
| `grep "kb/技术/ai/" overview.html` | timeline W18 中 CNN/RNN/Transformer 还在用旧路径 `kb/技术/ai/cnn.md` |
| 看 `viewContent(path)` | `if (!file) return;` 静默 return，找不到 path 时无任何提示 |
| 看 `check-overview.js` 第 2 项 | 只检查 `categories` 的 path，**没遍历 `FI.timeline[].entries[].links[].url`** |

**3 个问题点 + 1 个机制缺陷**：

1. **数据问题**：commit 7463507 把 `kb/技术/ai/` 从两层重构为三层（基础/大模型/应用生态）时，只改了 `categories`，**漏改了 `timeline.links` 里的旧路径**。
2. **行为问题**：`viewContent()` 找不到 path 时静默 `return`，用户感知是"点了没反应"，难定位。
3. **预防问题**：`check-overview.js` 第 2 项 path 实存检查只覆盖 `categories`（来自 `buildFileIndex`），漏覆盖 `timeline.links`，所以本次旧路径没被自动捕获。
4. **关于"搜索 LLM 部分可点部分不可点"**：searchKB 的结果集 = buildFileIndex 的 keys（都是 `categories` 里的合法 path），所以**搜索结果一定可点**。用户感知到的"部分不可点"实际上是把 timeline 区块里 LLM 链接（旧路径）和搜索结果混淆了。本次修完 timeline 旧路径后即解决。

**修复**：

```diff
// FILE_INDEX.timeline W18
- {"label": "CNN", "url": "kb/技术/ai/cnn.md"},
- {"label": "RNN", "url": "kb/技术/ai/rnn.md"},
- {"label": "Transformer", "url": "kb/技术/ai/transformer.md"},
+ {"label": "CNN", "url": "kb/技术/ai/基础/cnn.md"},
+ {"label": "RNN", "url": "kb/技术/ai/基础/rnn.md"},
+ {"label": "Transformer", "url": "kb/技术/ai/基础/transformer.md"},

// viewContent
- if (!file) return;
+ if (!file) {
+   console.warn('[viewContent] FILE_INDEX 中不存在 path: ' + path + '，请检查 FILE_INDEX.timeline 链接或 categories 数据，并跑 node scripts/check-overview.js');
+   return;
+ }
```

`scripts/check-overview.js` 第 2 项扩展出 2b 子项，遍历 `FI.timeline[].entries[].links[].url` 检查实存，扩展后第一次跑就 FAIL 出这 3 条旧路径，证明机制有效。

**通用教训**：

- **结构升级要"全字段扫描"**：FILE_INDEX 持有 path 的字段不止 `categories`，还有 `timeline.links`。任何持有 path 的数据结构发生重构时，都要 grep 全部使用点。
- **静默失败是 bug 滋生土壤**：UI 层的"找不到就 return"会让数据问题永远不暴露。改成 `console.warn` 后，开发期 DevTools 一打开就能看到 `[viewContent] FILE_INDEX 中不存在 path: xxx`，定位成本从"半小时排查"降到"5 秒看 console"。
- **check 脚本的覆盖度要随数据结构同步扩展**：每新增一个持 path 的字段，就要在 check 脚本里加一项实存校验，否则就是"白名单漏检"。
