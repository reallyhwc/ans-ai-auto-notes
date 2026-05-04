# Agent 与 MCP 生态

> 最后整理: 2026-05-04 | 来源: 多轮对话

## 一句话定位

Agent 是"能调用工具、多步循环完成任务"的 LLM 应用形态。MCP 是连接 Agent 和外部工具的开放协议。微调是让通用模型学会你的领域。

> 关联: [[./llm]] — LLM 核心原理 | [[./llm-prompt-rag]] — Prompt 与 RAG 体系

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

### 1.4 Agent 的关键：工具调用（Function Calling）

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

---

## 2. MCP（Model Context Protocol）：AI 界的 USB-C

### 2.1 解决什么问题

```
之前: 每个 LLM 平台对接外部工具都是私有协议
  ChatGPT Plugins → OpenAI 私有协议
  Claude Tools    → Anthropic 私有格式  
  Gemini Tools    → Google 私有格式
  → 工具开发者要为每个平台写一套适配代码

MCP 之后:
  任何 LLM ←→ MCP 协议 ←→ 任何工具/数据源
  → 写一次 MCP Server，所有支持 MCP 的 LLM 都能用
```

### 2.2 架构：Client-Server

```
┌──────────────────────────────────────────────────┐
│                                                  │
│  ┌──────────┐    ┌──────────┐    ┌────────────┐  │
│  │ LLM Host │ → │ MCP      │ → │ MCP        │  │
│  │ (Claude) │    │ Client   │    │ Server A   │  │
│  └──────────┘    │ (协议层)  │    │ (文件系统)  │  │
│                  └──────────┘    └────────────┘  │
│                       │                          │
│                       │         ┌────────────┐   │
│                       ├────────→│ MCP        │   │
│                       │         │ Server B   │   │
│                       │         │ (Postgres) │   │
│                       │         └────────────┘   │
│                       │                          │
│                       │         ┌────────────┐   │
│                       └────────→│ MCP        │   │
│                                 │ Server C   │   │
│                                 │ (天气 API)  │   │
│                                 └────────────┘   │
└──────────────────────────────────────────────────┘
```

MCP Server 暴露三种能力：

| 能力 | 含义 | HTTP 类比 |
|------|------|-----------|
| **Resources** | 暴露数据（"我能读这些文件/数据库"） | GET |
| **Tools** | 可执行操作（"我能发邮件、查天气"） | POST |
| **Prompts** | 预定义 Prompt 模板（"我擅长代码审查"） | 静态资源 |

---

## 3. MCP 协议实现内幕

### 3.1 通信层：JSON-RPC 2.0

MCP 底层是 **JSON-RPC 2.0**，通过 stdio（标准输入输出）或 HTTP SSE 传输：

```
MCP Client                         MCP Server
    │                                   │
    │  → {"jsonrpc":"2.0",              │
    │     "method":"tools/list",        │  (发现工具)
    │     "id":1}                       │
    │                                   │
    │                    {"jsonrpc":"2.0",│
    │                     "id":1,        │
    │                     "result":{     │
    │                       "tools":[    │
    │                         {"name":"query_db",
    │                          "description":"执行SQL查询",
    │                          "inputSchema":{
    │                            "properties":{
    │                              "sql":{"type":"string"}
    │                            }}}]}}   │
    │                                   │
    │  → {"jsonrpc":"2.0",              │
    │     "method":"tools/call",        │  (调用工具)
    │     "params":{                    │
    │       "name":"query_db",          │
    │       "arguments":{               │
    │         "sql":"SELECT SUM(amount) │
    │          FROM orders              │
    │          WHERE date > '...'"}}    │
    │     "id":2}                       │
    │                                   │
    │                    {"jsonrpc":"2.0",│
    │                     "id":2,        │
    │                     "result":{     │
    │                       "content":[  │
    │                         {"type":"text",
    │                          "text":"销售额: ¥1,234,567"}
    │                       ]}}          │
```

### 3.2 Agent 怎么知道何时调用

Agent 不是"配置了 MCP 就自动会用"，分为两步：

```
Step 1: LLM 推理时
  系统 Prompt 中注入了工具列表:
  "你可以使用以下工具:
   - query_db(sql): 执行 SQL 查询
   - send_email(to, subject, body): 发送邮件"

  LLM 处理用户输入 → 判断"这需要查数据库" → 输出工具调用指令

Step 2: Agent 框架拦截
  框架检测到 LLM 输出的是工具调用 → 真正执行 MCP 请求
  → 收到结果 → 把结果重新注入对话 → LLM 继续生成最终回复
```

**MCP 只定义"怎么调用工具"的协议。LLM 什么时候调用、为什么调用——是 Agent 框架 + Prompt 驱动的。**

---

## 4. MCP 服务发现与自定义开发

### 4.1 怎么发现：配置文件，不是注册中心

**MCP 没有注册中心——通过 JSON 配置文件静态声明。**

```
~/.claude/claude_desktop_config.json:

{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-postgres", "postgresql://localhost/mydb"]
    },
    "my-tool": {
      "command": "java",
      "args": ["-jar", "/path/to/my-mcp-server.jar"]
    }
  }
}
```

启动时 Claude Code 读这个文件 → 对每个 Server 启动子进程 → 通过 stdio 建立 JSON-RPC 通道。

### 4.2 与 Dubbo 对比

| | Dubbo | MCP |
|------|-------|-----|
| 注册中心 | Zookeeper/Nacos | 无，JSON 文件静态配置 |
| 服务发现 | 动态注册+发现 | 启动时读文件，启动子进程 |
| 通信协议 | Dubbo 协议 (TCP) | JSON-RPC 2.0 (stdio/HTTP) |
| 接口定义 | Java Interface | JSON Schema (inputSchema) |
| 提供者 | Provider 注册到注册中心 | 子进程，由 Client 启动和管理 |

### 4.3 写一个 Java MCP Server（伪代码）

```java
public class MyMcpServer {
    public static void main(String[] args) {
        while (true) {
            String request = readLine(System.in);
            JsonRpcRequest req = parse(request);
            
            switch (req.method) {
                case "tools/list":
                    respond(new Tool[]{
                        new Tool("query_orders", "查询用户订单",
                            Map.of("userId", "string")),
                        new Tool("refund", "发起退款",
                            Map.of("orderId", "string", "amount", "number"))
                    });
                    break;
                    
                case "tools/call":
                    if (req.params.name.equals("query_orders")) {
                        List<Order> orders = db.query(
                            "SELECT * FROM orders WHERE user_id = ?",
                            req.params.arguments.get("userId"));
                        respond(orders);
                    }
                    break;
            }
        }
    }
}
```

本质就是：读 stdin → 解析 JSON-RPC → 执行业务逻辑 → 写 stdout。

---

## 5. AI 工具的层级分类

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

### 5.1 Claude Code 工作原理

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

### 5.2 Claude Code 修 bug 的完整多轮流程

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

### 5.3 Superpowers 是什么

**Superpowers = Claude Code 的插件/技能系统。** 不是独立工具，是给 Claude Code 装"工作流"。

```
没有 Superpowers:
  你: "帮我规划功能" → Claude Code 直接写代码 → 可能跑偏

有 Superpowers:
  你: "帮我规划功能"
    → brainstorming 技能: 探索 → 提问 → 设计 → 确认
    → writing-plans 技能: 写实现计划 → 确认
    → subagent-driven-development: 分派子 Agent 逐个实现
```

**Superpowers 本质是一套预定义的 Prompt 模板 + 工作流指令**（skill 文件），告诉 Claude Code 在不同场景下应该怎么行为。

| | Claude Code | Superpowers |
|------|-------------|-------------|
| 是什么 | Agent 产品 (L4) | 插件/技能系统 (L5) |
| 独立运行 | 可以 | 不可以，依附 Claude Code |
| 提供什么 | LLM + 工具执行能力 | 预定义工作流 + 最佳实践 |
| 类比 | IDE | IDE 的插件 |

---

## 6. 微调（Fine-tuning）：让通用模型学你的领域

### 6.1 基座模型 vs 微调后模型

```
基座模型 (Base Model):
  训练数据: 互联网海量文本
  能力: 什么都会一点，什么都不精
  问题: 不懂你的业务术语

微调后模型 (Fine-tuned Model):
  在基座模型基础上，用你的特定数据再训练一小轮
  能力: 学会了你的领域知识、输出格式、语气风格
```

### 6.2 具体例子

```
基座模型面对客服:
  用户: "我的订单三天了还没发货"
  模型: "很抱歉听到这个，你可以联系客服..." ← 太泛了

微调后 (1000条真实客服对话训练):
  用户: "我的订单三天了还没发货"
  模型: "已为您查询，订单 #20260504-0032 状态为'待拣货'，
         预计明天发货。我已标记加急处理。是否需要修改收货地址？"
```

### 6.3 全量微调 vs LoRA

| 方式 | 做法 | 成本 |
|------|------|------|
| **全量微调** | 更新模型的全部参数 | 多张 A100/H100 GPU |
| **LoRA** | 只训练一小部分新增参数，原参数不动 | 一张消费级显卡 |

LoRA 的思路：不修改原模型权重，旁边挂两个小矩阵（A 和 B），只训练它们。效果接近全量微调，成本降几个数量级。

---

## 7. 四个概念的关系全景

```
                    LLM (基座模型)
                         │
            ┌────────────┼────────────┐
            │            │            │
         微调后          │          Agent
        (学你的领域)      │      (能调用工具、多步循环)
            │            │            │
            └────────────┼────────────┘
                         │
                    Prompt (输入)
                         │
                    ┌────┴────┐
                    │         │
                 普通提问   RAG (外挂知识库)
                直接回答   检索→增强→生成
```

一个完整的实际产品通常是：**微调后的模型 + RAG + Agent 能力 + 精心设计的 Prompt**。

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
     │
     ▼
  微调后的 LLM 生成回答
```

> 关联: [[./llm]] — LLM 核心原理
> 关联: [[./llm-prompt-rag]] — Prompt 与 RAG 体系
