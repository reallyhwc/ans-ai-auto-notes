---
name: overview.html Maintenance Rules
description: overview.html 从 content embedding 改为 runtime fetch，新规则：用 serve.sh 启动、FILE_INDEX 元数据、禁止裸链接
type: feedback
originSessionId: 712f8494-9951-406a-9368-fd194238f662
---
**架构变更（2026-05-05）**：overview.html 从"构建时嵌入所有 md 内容"改为"运行时 fetch .md 文件"。旧规则（KB_DATA、content 字段、JS 语法检查、vm.runInContext 同步）全部废弃。

新规则：

1. **必须通过 serve.sh 启动本地 HTTP 服务器**：浏览器无法直接 fetch `file://` 协议下的 .md 文件。`./serve.sh` 一键启动 python3 http.server 并自动打开浏览器。
2. **FILE_INDEX 只含元数据**：`title`、`path`、`desc`，不含 `content` 字段。新增文件时同步更新 FILE_INDEX 中的 files 数组。
3. **禁止裸 `<a href="xxx.md">` 链接**：浏览器直接打开 .md 文件会乱码。所有查看入口走 `viewContent(path)` → fetch → renderMarkdown。
4. **修改 .md 文件后无需同步 HTML**：md 是单一事实源，overview.html 运行时读取最新内容。

**Why:** 2026-05-05 用户反馈每次笔记整理耗时太久。根因分析发现 overview.html content embedding 是最大瓶颈——每次改 md 还要同步 HTML 嵌入内容（Read 140KB HTML → vm.runInContext 解析 → 替换 → 序列化 → JS 语法检查 → 一致性校验，每次 5-6 步）。改为 fetch 模式后，笔记记录从 5-6 步降至 2-3 步（写 md + 更新 INDEX + 偶尔更新 FILE_INDEX）。

**How to apply:** 涉及 overview.html 修改时，用以上 4 条新规则替换旧思维。不再需要 JS 语法检查、vm.runInContext、content 字段同步。
