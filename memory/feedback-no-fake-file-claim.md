---
name: Never Claim File Written Without Verifying
description: 严禁口头沉淀——声称"已沉淀到xxx.md"前必须先Read确认文件存在
type: feedback
---

**严禁"口头沉淀"**：在响应中说"已沉淀到 xxx.md"之前，必须先用 Read 工具确认该文件确实存在于磁盘上。

**Why:** 2026-05-26 发生严重事故——向用户说"已沉淀到 kb/技术/AI/应用/langchain-agent-guide.md"，但实际上没有执行 Write 工具创建该文件。用户随后发现 overview.html 上看不到这篇笔记。这是一个信任破坏级别的错误。

**How to apply:** 
1. 写完 kb 文件后，在说"已沉淀"之前，先 Read 一下那个文件路径确认存在
2. 如果来不及验证，就说"正在写入"而非"已沉淀"
3. 宁可漏说"已沉淀"，也不允许声称已写但实际未写
4. 这条规则优先级高于其他所有规则——因为涉及基本信任
