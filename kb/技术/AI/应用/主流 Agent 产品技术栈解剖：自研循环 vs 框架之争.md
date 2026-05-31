---
title: "主流 Agent 产品技术栈解剖：自研循环 vs 框架之争"
description: "Claude Code/OpenClaw/Hermes Agent 技术栈拆解，为什么顶级 Agent 产品都不用 LangChain/Spring AI，Agent 循环对比（TAOR/Hub-and-Spoke/run_conversation）"
---

# 主流 Agent 产品技术栈解剖

> 最后整理: 2026-05-26 | 来源: Claude Code 源码分析 + 对话讨论

> 关联: [ai-agent-tools](./AI Agent 工具生态.md) — Hermes vs OpenClaw 功能对比
> 关联: [agent-development-practice](./Agent 开发实战：选型、框架与思维转换.md) — Agent 开发四大范式与框架选型
> 关联: [spring-ai-vs-langchain](./Spring AI vs LangChain 深度对比：从 Java 后端视角彻底搞懂.md) — Spring AI vs LangChain 深度对比

---

## 1. 核心结论

> **市面上最火的 Agent 产品，没有一个使用 Agent 框架。全部是自研 Agent 循环。**

| 产品 | 语言 | 运行时 | Agent 循环 | 用框架了吗 |
|------|------|--------|-----------|-----------|
| **Claude Code** | TypeScript | **Bun** | 自研 TAOR | ❌ |
| **OpenClaw** | TypeScript | Node.js | 自研 Hub-and-Spoke | ❌ |
| **Hermes Agent** | Python | CPython | 自研 `run_conversation()` | ❌ |
| **OpenAI Agents SDK** | Python | CPython | 自研 `Runner.run()` | ❌ |

为什么？因为这些产品需要的控制粒度远超框架能提供的——权限检查、上下文压缩、子 Agent 编排——每一环都必须自己做才能达到产品级质量。

---

## 2. Claude Code 技术栈（深度解剖）

```
┌──────────────────────────────────────────────────┐
│              Claude Code 架构                     │
│                                                  │
│  语言: TypeScript (51.2 万行, ~1900 文件)         │
│  运行时: Bun (不是 Node.js)                       │
│  终端 UI: React + Ink (React 跑在终端里)           │
│  参数解析: Commander.js                           │
│  数据校验: Zod v4                                 │
│  Shell 解析: tree-sitter WASM (AST 级解析)        │
│                                                  │
│  核心文件:                                        │
│  ┌─────────────────────────────────────────┐     │
│  │ QueryEngine.ts (~46000 行!)             │     │
│  │ 单文件包含: LLM API 调用、流式处理、      │     │
│  │ 缓存管理、速率限制、上下文预算管理         │     │
│  └─────────────────────────────────────────┘     │
│                                                  │
│  分层架构:                                        │
│  cli/         → React + Ink 终端 UI              │
│  tools/       → 40+ 工具模块                      │
│  core/        → System Prompt, 权限, 常量         │
│  assistant/   → 多 Agent 编排 (Coordinator-Worker)│
│  services/    → API 调用, 上下文压缩, OAuth       │
│                                                  │
│  权限系统: 7 级频谱                               │
│  plan → default → acceptEdits → auto             │
│  → dontAsk → bypassPermissions → bubble          │
│  auto 级别有 ML 分类器守门                         │
│                                                  │
│  上下文压缩: 3 级                                 │
│  MicroCompact → AutoCompact → Full Compact       │
│  由模型自己决定压缩什么                            │
└──────────────────────────────────────────────────┘
```

### TAOR 循环：一个 `while(true)` 就是全部

```typescript
// Claude Code 的 Agent 循环本质（简化）
while (!taskComplete) {
  const response = await claudeApi.call(messages, tools);

  if (response.isToolCall) {
    await checkPermission(response.toolName);  // ← 7 级权限检查
    const result = await executeTool(response);
    messages.append({ role: "tool", content: result });
  } else {
    return response.text;  // ← 最终回复
  }

  maybeCompactContext(messages);  // ← 3 级上下文压缩
}
```

**没有魔法。就是 `while` + `if`。框架帮你省的就是这个循环——但产品需要的是每个环节的自定义。**

---

## 3. OpenClaw 技术栈

```
语言: TypeScript (Node.js)
架构: Hub-and-Spoke

Gateway (WebSocket 常驻进程)
  → Agent (任务分解)
    → Skills (插件化扩展, ClawHub 社区市场)
      → Memory (Markdown + SQLite 持久化)

核心创新:
  - Lane Queue: 会话级任务排队，不依赖外部消息队列
  - SOUL.md: 纯 Markdown 定义 Agent 身份与行为边界
  - 可插拔上下文引擎: 插件自定义压缩与组装策略

安全:
  - CVE-2026-25253 (CVSS 8.8) WebSocket 注入高危
  - ~12% ClawHub 技能含恶意代码
  - 不建议装在主力机上
```

---

## 4. Hermes Agent 技术栈

```
语言: Python (3.11+)
架构: 五层

入口与编排层 (CLI + Gateway)
  → Agent 核心层 (run_conversation() 同步循环)
    → 工具与注册层 (ToolRegistry 单例, 运行时可用性检查)
      → 状态与持久化层 (SQLite + WAL + FTS5)
        → 平台适配层 (15+ 消息平台)

关键设计决策:
  - 同步而非异步: Agent 瓶颈是 LLM 延迟(秒级)，不是 I/O 并发
  - ThreadPoolExecutor 处理并行 (最多 8 worker)
  - 三层记忆: MEMORY.md(~800 Token) + Skills 目录 + SQLite FTS5
  - 记忆注入策略: 会话开始快照注入 prompt，运行中不更新
    → 保证 Anthropic 前缀缓存持续命中

子 Agent 隔离:
  - 最大委托深度: 2
  - 子 Agent 独立上下文
```

---

## 5. 三个 Agent 循环对比

```
Claude Code (TAOR):
  while (taskNotComplete) {
    response = claudeApi.call(messages, tools);
    if (response.isToolCall) {
      checkPermission(response.toolName);  // ← 7 级权限
      result = executeTool(response);
      messages.append(result);
    } else {
      return response.text;
    }
    maybeCompactContext(messages);  // ← 3 级压缩
  }

Hermes Agent:
  while (conversationActive) {
    response = llm.generate(messages);
    if (response.hasToolCalls) {
      for (tool in response.toolCalls) {
        if (toolRegistry.isAvailable(tool)) {  // ← 运行时可用性
          result = tool.execute();
          messages.append(result);
        }
      }
    }
    memoryManager.save(messages);  // ← SQLite 持久化
  }

OpenClaw:
  gateway.receive(message) → laneQueue.enqueue(message)
  → agent.decompose(task) → skills.execute(subtasks)
  → memory.persist(results) → gateway.send(response)
```

**共同点**：都是最简单的 while 循环 + LLM 调用 + 工具执行。没有任何魔法。

---

## 6. 为什么不直接用 LangChain/Spring AI

```
用框架的好处:
  ✅ 快速起步，5 分钟跑通第一个 Agent
  ✅ 标准化抽象，换模型/换工具成本低
  ✅ 社区生态，有现成的 Memory/Prompt/Tracing 方案

产品级自研的原因:
  ❌ 框架的 Agent 循环无法插入权限检查
  ❌ 框架的上下文管理无法和产品级压缩策略结合
  ❌ 框架的 Tool 执行无法做子 Agent 编排
  ❌ 框架的 Tracing 无法满足产品级的审计需求
  ❌ 框架的抽象层越多，排查问题越困难

一句话:
  框架帮你从 0 到 1（快速验证想法）
  自研帮你从 1 到 100（产品级质量）
```

> 关联: [ai-agent-tools](./AI Agent 工具生态.md) — Hermes vs OpenClaw 功能对比
> 关联: [spring-ai-vs-langchain](./Spring AI vs LangChain 深度对比：从 Java 后端视角彻底搞懂.md) — 两个 Agent 框架的深度对比
> 关联: [agent-ops-and-resilience](./Agent 应用运维与韧性：架构之外的生存指南.md) — Agent 运维与韧性
