---
title: "Agent 与 MCP"
description: "Agent循环、MCP协议、FC机制、Skill定位、五者关系"
---

# Agent 与 MCP 生态

> 最后整理: 2026-05-23 | 来源: 多轮对话（拆分重组 + FC vs MCP 深度对比 + Agent vs MCP 对比）

## 一句话定位

Agent 是"能调用工具、多步循环完成任务"的 LLM 应用形态。MCP 是连接 Agent 和外部工具的开放协议。微调是让通用模型学会你的领域。

> 关联: [llm](./llm.md) — LLM 核心原理 | [llm-prompt-rag](./llm-prompt-rag.md) — Prompt 与 RAG 体系 | [ai-agent-tools](../应用/ai-agent-tools.md) — Agent 工具生态对比 | [claude-code-architecture](../Claude-Code/claude-code-architecture.md) — Claude Code 整体架构与工作流程

---

## 1. Agent（智能体）：让 LLM 能做事

### 1.1 普通 LLM vs Agent

```
普通 LLM:
  你: "帮我查一下今天北京天气"
  LLM: "抱歉，我无法获取实时数据"

Agent:
  你: "帮我查一下今天北京天气"  
  Agent 思考: 用户需要实时天气 → 我应该调用天气 API
  Agent 动作: 调用 weather_api("北京", "2026-05-04")
  收到结果: {"晴", "15°C-25°C"}
  Agent 输出: "今天北京晴天，气温 15°C 到 25°C。"
```

### 1.2 Agent 的核心循环

```
        ┌──────────────────────────┐
        │     Agent 循环             │
        │                          │
        │  ┌─────────┐             │
        │  │  思考    │ ← LLM 分析当前状态，决定下一步
        │  └────┬────┘             │
        │       │                  │
        │       ▼                  │
        │  ┌─────────┐             │
        │  │  行动    │ → 调用工具 (搜索/计算/API/写文件...)
        │  └────┬────┘             │
        │       │                  │
        │       ▼                  │
        │  ┌─────────┐             │
        │  │  观察    │ ← 工具返回结果
        │  └────┬────┘             │
        │       │                  │
        │       ▼                  │
        │  任务完成？ → 是 → 输出结果
        │       │                  │
        │       否 → 回到"思考"    │
        └──────────────────────────┘
```

### 1.3 具体例子：订机票 Agent

```
你: "帮我订一张 5 月 10 号北京飞上海的机票，要早上的航班"

Agent 循环:
  Round 1: 思考(需要搜航班) → 动作(search_flights) → 观察(15个航班)
  Round 2: 思考(筛选早上的) → 动作(输出候选列表) → 观察(用户选CA1234)
  Round 3: 思考(需要下单)   → 动作(book_flight)   → 观察(订单创建成功)
  输出: "已为您预定 CA1234，5月10日 08:30 北京→上海，订单号 ORDER-8842。"
```

### 1.4 Agent 的关键：Function Calling（函数调用）

**Function Calling 是 LLM 的一种"输出格式能力"——LLM 不会真的调用函数，它只是输出一个结构化的 JSON 说"我想调这个函数"。**

```
用户: "北京今天天气怎么样？"

LLM 内部推理: "我不知道实时天气，但我可以调一个天气查询函数"
LLM 输出（不是文字回复，是 JSON）:
{
  "function_call": "getWeather",
  "arguments": {"city": "北京", "date": "2026-05-04"}
}

框架层（Spring AI / LangChain）收到这个 JSON:
  → 找到 getWeather 的实现（本地函数 / HTTP API / MCP 工具）
  → 真正执行: httpGet("https://weather-api.com/beijing")
  → 拿到结果: {"temp": 25, "weather": "晴"}

把结果塞回 LLM:
  "之前你说要查天气，结果回来了：25度，晴天"

LLM 最终输出:
  "北京今天晴天，气温 25°C，适合出门~"
```

### 1.5 Function Calling vs MCP：决策层 vs 执行层

**Function Calling 和 MCP 是两个完全不同层次的东西，但因为都跟"工具调用"相关，经常被混在一起。**

用一个查天气的例子看全程：

```
用户: "北京今天天气怎么样？"

Step 1 — Function Calling（LLM 推理，GPU 上）
  LLM 判断"用户需要天气数据，我应该调 getWeather 工具"
  → 输出 JSON（不是文字回复）:
  {
    "tool_calls": [{
      "function": {"name": "getWeather", "arguments": {"city": "北京"}}
    }]
  }
  ← FC 的全部作用就到这里：输出一段结构化的"意图声明"。不执行任何东西。

Step 2 — 框架执行（本机 CPU，FC 完全不参与）
  框架收到 tool_call JSON → 找到 getWeather 的实现:
  ├── 如果是本地 Bean:  orderService.queryByUser("123")    // Java 方法直调
  ├── 如果是 HTTP API:  fetch("https://api.weather.com/")   // REST 调用
  └── 如果是 MCP 工具:  拼 JSON-RPC → stdin → Java 子进程   // MCP 管道
                        → {"jsonrpc":"2.0","method":"tools/call","params":{...}}
                        → 子进程反射调用 @Tool 方法 → stdout 返回结果

Step 3 — 结果喂回 LLM，组织成自然语言回复
```

**核心差异表**：

| 维度 | Function Calling | MCP |
|------|-----------------|-----|
| **本质** | LLM 的输出能力（模型 fine-tune 出的行为） | 工具通信协议（JSON-RPC 2.0 over stdio/HTTP） |
| **谁做的** | 模型推理（GPU 云端） | 框架/基础设施（本机进程） |
| **产出** | 结构化 JSON（"意图声明"） | 真正的工具执行结果（查了数据库、调了 API） |
| **标准化** | 各厂商格式不同——OpenAI 的 `tool_calls`、Anthropic 的 `tool_use`、Google 的 `functionCall` 字段名各不相同 | 跨厂商统一——写一次 MCP Server，所有支持 MCP 的 LLM 都能用 |
| **工具发现** | 无——工具列表由框架注入 System Prompt（"你可以使用以下工具: ..."） | `tools/list` 动态发现——启动时扫描 `@Tool` 注解 → 自动生成 JSON Schema |
| **生命周期** | 单次推理输出，无状态 | 管理工具全生命周期（spawn 子进程 → 发现 → 调用 → 进程保活/销毁） |
| **依赖关系** | 可以调 MCP 工具，也可以调非 MCP 的本地函数/REST API | 暴露的工具可以被 FC 选中调用 |

**用 Spring AI MCP 的完整链路感受两者分工**：

```
用户: "帮我查 user_id=123 的订单"

① FC（LLM 推理）:
   LLM 看到 System Prompt 里有 "queryOrders(userId)"
   → 判断: 用户要查订单，该调 queryOrders
   → 输出: {"tool_calls":[{"function":{"name":"queryOrders","arguments":{"userId":"123"}}}]}

② MCP Client（Claude Code）:
   收到 tool_call JSON → 拼 JSON-RPC:
   {"jsonrpc":"2.0","method":"tools/call","id":42,
    "params":{"name":"queryOrders","arguments":{"userId":"123"}}}

③ MCP 管道（stdin/stdout）:
   父进程 → 子进程 stdin → Java readLine() → 解析 → 反射调用

④ MCP Server（你的 @Tool 方法）:
   queryOrders("123") → orderService.queryByUser("123")
   → SELECT * FROM orders WHERE user_id = '123'
   → 返回 List<Order>

⑤ MCP 管道（stdout）:
   序列化结果 → stdout → 父进程收到 → 喂回 LLM

⑥ LLM 组织自然语言:
   "你共有 2 个订单: #8842 ¥299 已发货, #8843 ¥158 待付款"
```

**一句话：FC 是"决策"（我要调什么），MCP 是"执行"（怎么调通）。FC 告诉 Agent 该干什么，MCP 帮 Agent 真正干成。**

Agent 的能力取决于它能调用什么工具：

```
内置工具:
  - 搜索 (Google/Bing API)
  - 计算器 (精确算术)
  - 代码执行 (Python 沙箱)
  - 文件读写
  - 数据库查询

自定义工具:
  - 你的内部 API (查订单、发邮件、创建工单)
  - 第三方服务 (Slack、Jira、GitHub)
  - 浏览器自动化 (打开网页、填表单)
```

### 1.6 Agent 应用 vs MCP：完整系统 vs 工具管道

**这是比 FC vs MCP 更容易混淆的一对，因为两者都跟"工具调用"有关——但层次完全不同。**

**Agent 应用是一个完整的自主系统，MCP 只是一根标准化的工具连接线。**

```
┌─────────────────────────────────────────────────────────┐
│  Agent 应用（完整产品）                                    │
│                                                         │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐            │
│  │  LLM 大脑 │ → │ ReAct 循环│ → │ 工具调用  │            │
│  │  (推理)   │   │ (思考→行动)│   │          │            │
│  └──────────┘   └──────────┘   └────┬─────┘            │
│                                     │                   │
│  还有: 记忆系统、用户界面、Prompt 管理、错误处理...         │
│                                     │                   │
│                              ┌──────┴──────┐            │
│                              │             │            │
│                        本地函数        MCP 管道 ← 这里才是 MCP
│                        (直调)       (JSON-RPC)           │
│                                         │               │
│                                    ┌────┴────┐          │
│                                    │ MCP     │          │
│                                    │ Server  │ ← 工具提供者
│                                    └─────────┘          │
└─────────────────────────────────────────────────────────┘
```

**核心差异表**：

| 维度 | Agent 应用 | MCP（Server） |
|------|-----------|---------------|
| **是什么** | 能自主决策、多步执行任务的完整系统 | 标准化工具通信协议 / 工具提供者 |
| **有没有 LLM** | 有——这是 Agent 的"大脑" | 没有——MCP Server 只是个执行器 |
| **能不能自主决策** | 能——推理后决定下一步干什么 | 不能——只被动响应 `tools/call` |
| **有没有循环** | 有——ReAct 循环（思考→行动→观察→再思考） | 没有——纯粹的请求-响应 |
| **角色** | 决策者 + 执行者 | 被调用者 |
| **独立运行** | 可以独立服务用户 | 不能——必须被 Agent/MCP Client 连接才有意义 |
| **举例子** | Claude Code、ChatGPT、AutoGPT、自建客服 Bot | 一个暴露了查订单/退款能力的 JAR 包 |

**一句话：Agent 是"厨师"，MCP 是厨房里一个符合标准的"炉子接口"。厨师决定做什么菜、什么时候用炉子、怎么摆盘；炉子只管"开火-关火"。**

**实际项目中的关系**——一个 Spring Boot 应用可以同时是两者：

```
┌──────────────────────────────────┐
│  Spring Boot 应用                 │
│                                  │
│  HTTP 入口（Agent 服务）          │
│  POST /chat → AgentController    │
│    → DeepSeek API（推理+FC）      │
│    → 本地工具执行                 │
│    → 结果整合回复用户             │
│                                  │
│  MCP 入口（工具提供）             │
│  stdin ← Claude Code             │
│    → @Tool 反射调用               │
│    → stdout 返回结果              │
│                                  │
│  两者共享: OrderService（业务逻辑）│
└──────────────────────────────────┘
```

---

## 2. MCP 协议（已拆分为独立文件）

MCP（Model Context Protocol）是 AI 工具调用的标准化协议——写一次 Server，所有支持 MCP 的 LLM 都能用。

> **详细内容已拆分至：[MCP 协议：AI 界的 USB-C](./mcp-protocol.md)**
>
> 包含：MCP 痛点与架构、JSON-RPC 2.0 通信层、stdio OS 层细节（fork+pipe 完整交互序列）、服务发现机制（配置文件 vs 注册中心）、Spring AI 集成方案（`@Tool` + `@EnableMcpServer`）、纯手写方案、`@Tool` 注解内部机制（启动扫描→Schema 生成→完整请求链路）、与 Dubbo/Nacos 对比

---

## 3. `@Tool` 注解的内部机制

### 3.1 启动阶段：做了什么

和 `@GetMapping` 是同类东西——标记方法为"外部可调用入口"。启动时三步：

```
① 扫描: ApplicationContext.getBeansWithAnnotation(Tool.class)
        → 找到所有带 @Tool 的 Bean 和它们的 public 方法

② 提取: 对每个 @Tool 方法反射读取:
   @Tool(description = "查询订单")          → tool.description
   @ToolParam(description = "用户ID")       → inputSchema.userId.description
   String userId                             → inputSchema.userId.type = "string"
   int amount                                → inputSchema.amount.type = "integer"

③ 注册: 存入 Map<String, ToolCallback>
   key = "queryOrders"
   value = (arguments) → method.invoke(bean, deserialize(args))
```

**Java → JSON Schema 类型映射**：

| Java 类型 | JSON Schema type |
|-----------|-----------------|
| String | `"string"` |
| int / Integer / long | `"integer"` |
| double / BigDecimal | `"number"` |
| boolean | `"boolean"` |
| List\<String\> | `{"type":"array","items":{"type":"string"}}` |
| 自定义 DTO | `{"type":"object","properties":{...}}` |

如果一个 `@Tool` 方法的参数是自定义 DTO，Spring AI 会递归展开其字段，自动生成完整的 JSON Schema。

### 3.2 工具发现：tools/list 流程

```
Claude Code 启动
  │
  ├─ 读 .mcp.json → 找到 command + args
  ├─ spawn 子进程 → Java 应用启动
  │     └─ Spring Boot init
  │          └─ @EnableMcpServer → 注册 MCP 端点
  │               └─ 扫描所有 @Tool → 构建注册表 (Map<String, ToolCallback>)
  │
  ├─ 发 tools/list ──stdin──→ {"method":"tools/list", "id":1}
  │                           │
  │                     Java  └─ 遍历注册表 → 生成工具列表 JSON → stdout
  │
  └─ 收到 [{"name":"queryOrders","description":"...","inputSchema":{...}}, ...]
       │
       └─ 注入 LLM System Prompt:
           "你可以使用以下工具:
            - queryOrders(userId): 查询订单
            - refundOrder(orderId, amount): 发起退款"
```

**LLM 看到的不是 Java 代码，是 `tools/list` 返回的 JSON Schema。**

### 3.3 完整请求链路：从你说一句话到方法被调用

```
你: "帮我查 user_id=123 的订单"
          │
          ▼
① LLM 推理（第 1 次，不出声）
   看到 System Prompt 里有工具 "queryOrders(userId)"
   → 判断: 用户要查订单，该调 queryOrders
   → LLM 输出 tool_call JSON（不是文字回复）:
     {"tool_calls":[{"function":{"name":"queryOrders",
                     "arguments":{"userId":"123"}}}]}

② Claude Code MCP Client 拦截
   拼 JSON-RPC:
   {"jsonrpc":"2.0","method":"tools/call","id":42,
    "params":{"name":"queryOrders","arguments":{"userId":"123"}}}

③ 通过 stdin → Java 子进程

④ Spring AI 收到 → 解析 method="tools/call"
   → 从注册表 Map 找到 "queryOrders" 的 ToolCallback
   → 反序列化 arguments → userId="123"
   → 反射调用: method.invoke(orderMcpTools, "123")

⑤ 你的 @Tool 方法执行
   queryOrders("123")
     → orderService.queryByUser("123")    ← 走到已有的 Service
       → SELECT * FROM orders WHERE user_id = '123'
         → 返回 List<Order> [Order#8842, Order#8843]

⑥ 序列化 → JSON → 装进 MCP 响应格式
   {"jsonrpc":"2.0","id":42,
    "result":{"content":[{"type":"text","text":"[{\"orderId\":8842,...}]"}]}}

⑦ stdout → Claude Code 收到结果

⑧ 把结果喂回 LLM（第 2 次推理）
   "之前你让我查的订单结果: 订单#8842 ¥299 已发货, 订单#8843 ¥158 待付款"

⑨ LLM 组织自然语言:
   "你共有 2 个订单: #8842 ¥299 已发货, #8843 ¥158 待付款"
```

**关键：每次工具调用 = LLM 被调了 2 次**（第 1 次决定调哪个工具，第 2 次把工具结果组织成自然语言）。如果对话涉及多个工具调用（先查订单 → 再发起退款），每一步都是一次独立的 LLM 推理 + 工具执行循环。

### 3.4 一句话总结

`@Tool` → 启动时反射扫描生成 JSON Schema → `tools/list` 返回给 LLM → LLM 决定调用 → 框架反射执行你标注的方法 → 结果序列化返回 → LLM 组织成自然语言。

和 Spring MVC 的 `@GetMapping` → DispatcherServlet → 反射调用 Controller 是同一条思路，只是协议从 HTTP 换成了 JSON-RPC over stdio。

```
L1: 基座模型 (Foundation Model)
    GPT-4, Claude, DeepSeek, Qwen, LLaMA
    → 纯文本进，纯文本出

L2: 对话产品 (Chat Product)
    ChatGPT, Claude.ai, 通义千问 App
    → 模型 + 聊天 UI + 多轮对话记忆

L3: Agent 框架 (Agent Framework)
    LangChain Agent, AutoGPT, CrewAI, Dify
    → 模型 + 工具调用 + 多步循环

L4: 垂直领域 Agent 产品  ← Claude Code 在这
    Claude Code (编程), Cursor (编程), Devin (编程), Harvey (法律)
    → 针对特定领域深度优化的完整 Agent

L5: 插件/技能系统  ← Superpowers 在这
    扩展 L4 产品的行为和工作流
```

### 4.1 Claude Code 工作原理

**Claude Code = 编程 Agent。** 内部结构和 Agent 循环完全一致：

```
Claude Code 内部循环:

  你: "帮我把这个 bug 修了"
      │
      ▼
  ┌─────────┐
  │  LLM    │ ← Claude 模型 (云端 GPU) — 分析任务，制定计划
  └────┬────┘
      │ "我需要先读代码找到 bug"
      ▼
  ┌──────────┐
  │ 工具执行  │ → Read/Grep/Bash/Edit/Write
  └────┬─────┘
      ▼
  观察结果 → 任务没完成 → 回到 LLM 继续思考
      │
      完成 → 输出结果
```

核心能力 = **Claude 模型**（推理，云端）+ **工具集**（Read/Write/Edit/Bash/Grep，本机执行）。

### 4.2 Claude Code 修 bug 的完整多轮流程

```
你: "帮我修 UserService 的 NPE bug"

┌─────────────────────────────────────────────┐
│ LLM 调用 #1: 理解任务                        │
│ 输出: "搜索 UserService"                    │
│ 工具: Grep("UserService")                   │
├─────────────────────────────────────────────┤
│ LLM 调用 #2: 看到搜索结果                    │
│ 输出: "读取 UserService.java"               │
│ 工具: Read("src/.../UserService.java")      │
├─────────────────────────────────────────────┤
│ LLM 调用 #3: 看到代码                        │
│ 输出: "第 42 行 NPE，我来改"                 │
│ 工具: Edit(第42行, 加 null 检查)             │
├─────────────────────────────────────────────┤
│ LLM 调用 #4: Edit 成功                       │
│ 输出: "跑测试验证"                           │
│ 工具: Bash("mvn test -Dtest=UserServiceTest")│
├─────────────────────────────────────────────┤
│ LLM 调用 #5: 测试通过                        │
│ 输出: "修复完成。总结: 42行加了null检查"       │
│ (不再调用工具，直接返回给用户)                │
└─────────────────────────────────────────────┘
```

**本质：LLM 思考 → 调用工具 → 观察结果 → 再思考 → 循环直到完成。** 每轮工具调用本地执行，不消耗 LLM token。

### 4.3 Skill 到底是什么：结构化配置包，不是 MCP

**Skill = 一个可复用的"能力模板包"**，内容就是三样东西：

| 组成部分 | 例子（`superpowers:systematic-debugging`） |
|---------|-------------------------------------------|
| **Prompt 片段** | "你是系统调试专家，遵循以下步骤..." |
| **行为规则** | "必须先复现 bug 再修改代码" |
| **工作流约束** | "步骤 1: 复现 → 步骤 2: bisect → 步骤 3: 写假设 → 步骤 4: 验证 → 步骤 5: 修复" |

**Skill 不具备任何"执行能力"**——不能执行 bash、不能读文件、不能调 API、不能做任何 I/O。它只是一个**纯文本的规则注入包**，被 Agent 框架加载后拼接到 System Prompt 里。

**Skill（文档型）vs Skill（Superpowers 型）**：
- 文档型 Skill：一本操作手册，你翻看后照着做（cheat sheet）
- Superpowers Skill：一个**技能芯片**，插进大脑后你自动会了这套流程——有明确的触发条件、优先级、工具链约束，被 Agent 框架识别后**主动改变行为模式**

```
没有 Superpowers:
  你: "帮我规划功能" → Claude Code 直接写代码 → 可能跑偏

有 Superpowers:
  你: "帮我规划功能"
    → brainstorming 技能: 探索 → 提问 → 设计 → 确认
    → writing-plans 技能: 写实现计划 → 确认
    → subagent-driven-development: 分派子 Agent 逐个实现
```

**Superpowers = Claude Code 的插件/技能系统。** 不是独立工具，是给 Claude Code 装"工作流"。本质是一套预定义的 Prompt 模板 + 工作流指令，告诉 Claude Code 在不同场景下应该怎么行为。

| | Claude Code | Superpowers |
|------|-------------|-------------|
| 是什么 | Agent 产品 (L4) | 插件/技能系统 (L5) |
| 独立运行 | 可以 | 不可以，依附 Claude Code |
| 提供什么 | LLM + 工具执行能力 | 预定义工作流 + 最佳实践 |
| 类比 | IDE | IDE 的插件 |

---

## 5. 微调（已拆分为独立文件）

微调是在预训练基座模型上用你的领域数据再训练一轮，让通用模型变成领域专家。

> **详细内容已拆分至：[微调与 LoRA](./llm-finetuning.md)**
>
> 包含：全量微调 vs LoRA 对比、客服场景具体案例、成本对比

---

## 6. 五个概念的关系全景

```
                         ┌──────────────┐
                         │   用户输入     │
                         └──────┬───────┘
                                │
                         ┌──────▼───────┐
                         │   Prompt     │  ← "你现在是客服，可以查订单、退款..."
                         │   (指令)     │     告诉 LLM 有什么工具、怎么用
                         └──────┬───────┘
                                │
                         ┌──────▼───────┐
                         │     LLM      │
                         │  (大脑)      │
                         └──────┬───────┘
                                │
                   ┌────────────┼────────────┐
                   │            │            │
         输出文字回复    Function Calling    需要外部信息
         (直接回答)    (输出 JSON: "调XX")    但不知道该调谁
                   │            │            │
                   │    ┌───────▼───────┐    │
                   │    │ 工具怎么来的？ │    │
                   │    └───────┬───────┘    │
                   │            │            │
                   │   ┌────────┼────────┐   │
                   │   │        │        │   │
                   │ 本地函数  HTTP API  MCP │
                   │ (@Bean)  (REST)  (标准协议)
                   │   │        │        │   │
                   │   └────────┼────────┘   │
                   │            │            │
                   │    ┌───────▼───────┐    │
                   │    │   执行结果     │    │
                   │    └───────┬───────┘    │
                   │            │            │
                   │    ┌───────▼───────┐    │
                   │    │  结果喂回 LLM │    │
                   │    └───────┬───────┘    │
                   │            │            │
                   └────────────┼────────────┘
                                │
                         ┌──────▼───────┐
                         │   最终回复     │
                         └──────────────┘
```

### 概念对照表

| 概念 | 类比 | 在这个架构中的角色 |
|------|------|-------------------|
| **Agent** | 一个有手有脚、能自主决策的机器人 | 顶层概念，组合以下所有 |
| **Prompt** | 机器人的"大脑指令" | 告诉 LLM 干什么、怎么干、有什么工具可用 |
| **Skill** | 可插拔的"能力芯片" | 往 Prompt 注入一套规则 + 工作流 + 约束 |
| **Function Calling** | LLM 的"决策输出格式" | 不是调函数，是输出 JSON 说"我想调这个" |
| **MCP** | 机器人的"API 适配器层" | 统一标准去连接外部系统（暴露工具） |

### 具体例子：Claude Code 修 bug

```
Agent:  Claude Code 本身（能自主决策：读哪个文件、改哪里、跑什么测试）
Prompt: 系统 prompt "你是 Claude..." + 用户指令 "修复登录 bug"
Skill:  superpowers:systematic-debugging → 注入 "必须先复现再改代码" 等规则
Function Calling: LLM 输出 {"function": "bash", "args": {"cmd": "git log"}}
MCP:    暴露了 "执行 bash"、"读写文件"、"git" 等工具给 Agent
```

一个完整的实际产品通常是：**微调后的模型 + RAG + Agent 能力 + Skill 工作流 + 精心设计的 Prompt**。

```
例: 智能客服系统

  用户提问
     │
     ▼
  Prompt (含系统指令、用户画像、对话历史)
     │
     ▼
  RAG 检索 (产品知识库 → 找到相关文档)
     │
     ▼
  Agent 决策 (需要查订单号? 调退款 API? 还是直接回答?)
     │  ← Function Calling 输出 {"function": "queryOrder"}
     │  ← MCP 暴露 queryOrder 工具的实现
     ▼
  微调后的 LLM 生成回答
```

> 关联: [llm](./llm.md) — LLM 核心原理
> 关联: [llm-prompt-rag](./llm-prompt-rag.md) — Prompt 与 RAG 体系
> 关联: [mcp-protocol](./mcp-protocol.md) — MCP 协议实现内幕
> 关联: [llm-finetuning](./llm-finetuning.md) — 微调与 LoRA
