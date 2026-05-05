---
name: Local Preview Architecture
description: overview.html 改为本地 HTTP 服务器 + runtime fetch 模式，serve.sh 一键启动
type: project
originSessionId: 712f8494-9951-406a-9368-fd194238f662
---
**架构**：`./serve.sh` → `python3 -m http.server`（端口 8765）→ 浏览器打开 `http://localhost:8765/overview.html`。

- overview.html 通过 `fetch()` 运行时读取 .md 文件，`contentCache` 缓存避免重复请求
- FILE_INDEX 只存元数据（title/path/desc），不嵌入内容
- 服务器 idle 时 0% CPU / ~5MB RAM，几乎不消耗资源
- 首次加载时 `checkServer()` 通过 HEAD 请求检测服务器是否在运行，未运行则显示启动引导

**Why:** 用户喜欢在 HTML 中翻看笔记的体验，但 content embedding 导致每次 md 改动都要同步 HTML（5-6 步操作）。改为 fetch 模式后 md 是单一事实源，笔记记录从 5-6 步降至 2-3 步。用户选择了本地 HTTP 服务器方案（Option A）而非构建脚本方案（Option B），接受 localhost 前提。

**How to apply:** 每次笔记整理流程：写 md 文件 → 更新 INDEX.md → 如果新增文件则更新 overview.html 的 FILE_INDEX。不需要再同步 content、跑 JS 语法检查、或做内容一致性比对。
