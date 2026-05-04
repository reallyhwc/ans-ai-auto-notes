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
