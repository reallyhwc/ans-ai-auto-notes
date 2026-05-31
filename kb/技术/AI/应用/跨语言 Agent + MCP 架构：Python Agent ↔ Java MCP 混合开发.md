---
title: "跨语言 Agent + MCP 架构：Python Agent ↔ Java MCP 混合开发"
description: "LangChain 双语言支持(Python/JS)、Python写Agent+Java写MCP的正反两种方案、MCP协议抹平语言差异的配置示例、推荐架构"
---

# 跨语言 Agent + MCP 架构

> 最后整理: 2026-05-26 | 来源: 对话讨论

> 关联: [agent-development-practice](./Agent 开发实战：选型、框架与思维转换.md) — Spring AI Agent 开发
> 关联: [langchain-agent-guide](./LangChain Agent 开发指南：是什么、怎么用、与 Spring AI 对比.md) — LangChain Agent 开发指南
> 关联: [spring-ai-vs-langchain](./Spring AI vs LangChain 深度对比：从 Java 后端视角彻底搞懂.md) — 两个框架深度对比
> 关联: [llm-agent-mcp](../大模型/Agent 与 MCP.md) — MCP 协议原理

---

## 1. LangChain 只能用 Python 吗？

**不是。** LangChain 有两个官方 SDK：

| SDK | 语言 | 成熟度 | 安装 |
|-----|------|--------|------|
| **langchain** | Python | 最成熟，生态最全 | `pip install langchain` |
| **langchain.js** | TypeScript/JavaScript | 较成熟，功能跟进中 | `npm install langchain` |

**但没有 Java SDK。** 对 Java 开发者有三种选择：

```
选项 A: Python langchain（推荐，生态最全）
选项 B: langchain.js（如果你更熟悉 TypeScript）
选项 C: 不直接用 SDK，通过 HTTP 调用 LangChain 服务
```

---

## 2. MCP 协议是语言无关的

MCP 通信走 **stdio**（标准输入输出）或 **HTTP**（Streamable HTTP），和编程语言没有任何绑定。这意味着：

> **Agent 用什么语言写，MCP Server 用什么语言写，完全解耦。**

---

## 3. 方案 A：Python 写 Agent，Java 写 MCP Server

```
┌─────────────────────┐     stdio/HTTP      ┌─────────────────────┐
│   Python Agent       │ ◄──────────────────► │   Java MCP Server    │
│   (LangChain)        │                      │   (Spring AI)        │
│                      │   list_tools()       │                      │
│   编排 Agent 流程     │ ────────────────────►│   暴露业务工具         │
│   管理对话/上下文     │                      │   @Tool 注解          │
│   调 LLM API         │ ◄────────────────────│   Service 层          │
│                      │   tool_result        │                      │
└─────────────────────┘                      └─────────────────────┘

优势: Python 生态做 Agent 编排最灵活，Java 做业务工具最成熟
```

### 配置

```json
// Python Agent 项目的 .mcp.json
{
  "mcpServers": {
    "order-service": {
      "command": "java",
      "args": ["-jar", "target/order-mcp-server.jar"]
    },
    "user-service": {
      "command": "java", 
      "args": ["-jar", "target/user-mcp-server.jar"]
    }
  }
}
```

```python
# Python Agent 自动发现 Java MCP 工具
from langchain_mcp_adapters.client import MultiServerMCPClient

async with MultiServerMCPClient({
    "order-service": {
        "command": "java",
        "args": ["-jar", "target/order-mcp-server.jar"]
    }
}) as client:
    tools = client.get_tools()  # ← Java @Tool 自动变成 Python tool
    agent = create_react_agent(llm, tools, prompt)
    result = agent.invoke({"input": "查订单123"})
```

---

## 4. 方案 B：Java 写 Agent，Python 写 MCP Server

```
┌─────────────────────┐     stdio/HTTP      ┌─────────────────────┐
│   Java Agent          │ ◄──────────────────► │   Python MCP Server   │
│   (Spring AI)         │                      │   (FastMCP)           │
│                       │   list_tools()       │                       │
│   ChatClient           │ ────────────────────►│   暴露 Python 工具     │
│   FunctionCallback     │                      │   数据分析/爬虫/ML    │
│                       │ ◄────────────────────│                       │
│                       │   tool_result        │                       │
└─────────────────────┘                      └─────────────────────┘

适用: 团队主力是 Java，但有些工具更适合 Python（数据分析、爬虫、ML推理）
```

### 配置

```java
// Spring AI 通过 MCP Client 连接 Python MCP Server
@Bean
public McpClient pythonTools() {
    return McpClient.using(
        new StdioTransport(
            "python", "-m", "my_mcp_server"
        )
    ).sync();
}
// Python MCP Server 的 @tool 自动变成 Java FunctionCallback
```

---

## 5. 推荐架构

```
┌────────────────────────────────────────────────┐
│                  推荐架构                        │
│                                                │
│  Python (LangGraph)                             │
│  └→ Agent 编排 + 对话管理 + LLM 调用              │
│      ↓ MCP (stdio)                              │
│  Java (Spring Boot × N)                         │
│  └→ 订单服务 MCP Server (@Tool)                 │
│  └→ 用户服务 MCP Server (@Tool)                 │
│  └→ 支付服务 MCP Server (@Tool)                 │
│                                                │
│  原因:                                           │
│  - Python 做 Agent 编排最灵活（LangGraph 状态机）  │
│  - Java 做业务工具最成熟（复用现有 Service 层）     │
│  - MCP 协议抹平了语言差异                         │
│  - 各 MCP Server 独立部署，独立扩缩容              │
└────────────────────────────────────────────────┘
```

---

> 关联: [agent-development-practice](./Agent 开发实战：选型、框架与思维转换.md) — Spring AI Agent 开发
> 关联: [langchain-agent-guide](./LangChain Agent 开发指南：是什么、怎么用、与 Spring AI 对比.md) — LangChain Agent 开发指南
> 关联: [spring-ai-vs-langchain](./Spring AI vs LangChain 深度对比：从 Java 后端视角彻底搞懂.md) — 两个框架的深度对比
> 关联: [llm-agent-mcp](../大模型/Agent 与 MCP.md) — MCP 协议原理
