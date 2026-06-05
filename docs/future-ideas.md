# Future Ideas / Backlog

> 未来想做的事情，有空了从里面挑着干。不分优先级，想到就加。

## Format

每条记录包含：
- **标题**：一句话说清楚要做什么
- **动机**：为什么想做
- **规模估算**：S（半天）/ M（1-3 天）/ L（一周+）
- **备注**：相关参考、约束、灵感来源

---

## Ideas

### 1. 从 0-1 搭建一个 CLI Coding Agent

**动机**：深入理解 Claude Code / Aider 这类工具的内部原理，亲手体验 Agent Loop、Tool Use、Context 管理的工程取舍。

**规模**：M（demo 半天，做到可用级别 2-3 天）

**备注**：
- 最小版本 ~150 行 Python，只需 `anthropic` SDK
- 核心三工具：read_file / edit_file / bash
- 架构参考：[CLI Coding Agent 系统架构](../kb/技术/AI/应用/CLI Coding Agent 系统架构：从 REPL 到自主编程.md)
- 可选进阶方向：
  - [ ] 加 streaming 流式输出
  - [ ] 加权限确认（dangerous command 弹 y/n）
  - [ ] 加 context compaction（对话过长时压缩）
  - [ ] 加 MCP 工具扩展协议
  - [ ] 加 system prompt 从 CLAUDE.md 自动加载
  - [ ] 用 TypeScript 重写（体验 Anthropic SDK TS 版）

---

<!-- 
模板：复制下面这段，填好后粘贴到上面

### N. 标题

**动机**：xxx

**规模**：S / M / L

**备注**：
- xxx
-->
