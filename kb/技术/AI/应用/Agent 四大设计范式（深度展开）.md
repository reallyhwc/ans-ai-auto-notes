---
title: "Agent 四大设计范式（深度展开）"
description: "意图路由 / ReAct / Plan-and-Execute / Multi-Agent 四种范式的架构图、Prompt 模板、典型案例与对比"
---

# Agent 四大设计范式（深度展开）

> 最后整理: 2026-05-21 | 来源: 从 agent-development-practice.md 拆分（原文 599 行 / 12 章节超阈值）

> 关联: [agent-development-practice](<./Agent 开发实战：选型、框架与思维转换.md>) — 范式选型、框架速查、学习路径、vs Java 对比（本文的导览页）
> 关联: [llm-agent-mcp](<../大模型/Agent 与 MCP.md>) — Agent 循环、MCP 协议、FC 机制的概念原理
> 关联: [openai-agents-sdk](<./OpenAI Agents SDK 与多角色协作.md>) — Multi-Agent 范式的工业实现
> 关联: [agent-ops-and-resilience](<./Agent 应用运维与韧性：架构之外的生存指南.md>) — 运维/SRE 视角（可观测性、成本、熔断、开源方案）
> 关联: [Agent Observability：调用链追踪与排障](<./Agent Observability：调用链追踪与排障.md>) — 多 Agent 协作的 trace 拼树、span/parent_id 数据模型、Orchestrator-Worker 调用链分析

---

## 范式 1：意图路由（Router Pattern）

最简单也最常见的 Agent 范式。用一个电商客服答疑工具举例——用户发一句话，Agent 先判断意图，再决定怎么处理。

### 三层决策路由架构

```mermaid
flowchart TD
    U["用户输入"] --> R["意图路由层<br/>(LLM 做分类)"]

    R -->|"简单问候/闲聊"| A1["直接回复<br/>不调用任何工具"]
    R -->|"意图明确"| A2["工具调用<br/>查订单/商品/物流"]
    R -->|"意图模糊"| A3["追问澄清<br/>多轮对话收集信息"]

    A2 --> T1["Tool: 查订单详情"]
    A2 --> T2["Tool: 查商品库存"]
    A2 --> T3["Tool: 查物流轨迹"]

    A3 -->|"用户补充信息"| R

    T1 --> S["结果整合层<br/>(LLM 总结回答)"]
    T2 --> S
    T3 --> S
    S --> RESP["最终回复用户"]
```

### Prompt 即路由器

**核心洞察：意图识别不是独立模块，而是 System Prompt 的一部分。**

传统 NLP 需要训练分类模型 + 标注数据 + 单独部署。Agent 模式下，LLM 通过 Prompt 就能同时完成分类 + 参数提取 + 回复生成：

```python
SYSTEM_PROMPT = """你是一个电商客服助手。收到用户消息后，先判断意图类型：

## 意图分类规则
1. **直接回复** — 简单问候、闲聊、与业务无关的问题
2. **工具调用** — 用户在询问具体数据，且信息完整。例如：
   - "帮我查一下订单 2026050100123 的状态" → 调用 query_order
   - "这个商品还有货吗" → 调用 query_stock（需要商品ID）
3. **追问澄清** — 用户意图涉及业务，但信息不完整。例如：
   - "我要退货" → 缺少订单号，需要追问

## 可用工具
- query_order(order_id): 查询订单详情（状态、金额、物流）
- query_stock(product_id): 查询商品库存
- apply_refund(order_id, reason): 发起退款申请

## 行为要求
- 信息不完整时，友好追问缺少的字段，不要瞎猜
- 工具返回 JSON 后，用自然语言总结给用户
"""
```

### Function Calling 完整交互流程

一次交互拆解为两轮 LLM 调用：

```
用户: "帮我查一下订单 2026050100123 到哪了"

┌─ Round 1: LLM 推理 ────────────────────────┐
│ 输入: system_prompt + 用户消息 + tools 定义  │
│ LLM 内部思考: "要查订单物流，ID 完整"        │
│ LLM 输出（结构化 JSON，不是文字）:            │
│   { "tool_calls": [{                        │
│       "function": {                         │
│         "name": "query_order",              │
│         "arguments": "{\"order_id\":        │
│           \"2026050100123\"}" }}] }          │
└─────────────────────────────────────────────┘
         ↓ Agent 框架拦截，真正调用后端 API
┌─ Round 2: LLM 总结 ────────────────────────┐
│ 输入: 之前的对话 + API 返回的 JSON            │
│ LLM 输出: "您的订单已从杭州仓发出，          │
│   当前在北京分拣中心，预计明天送达。"          │
└─────────────────────────────────────────────┘
```

### 多轮追问：信息不完整时的自动澄清

```
用户: "我要退货"
LLM: "好的，请问您要退哪个订单？请提供订单号。"

用户: "上周买的那个手机壳"
LLM: "我帮您查了一下，您上周有两个订单：
      1. 订单 #0123 - 硅胶手机壳 ¥29
      2. 订单 #0456 - 钢化膜 ¥15
      请问要退哪一个？"

用户: "第一个"
LLM: → 调用 apply_refund(order_id="#0123", reason="用户主动退货")
     → "已为您提交退款申请，预计 1-3 个工作日到账。"
```

**追问不是写死的对话流程**，LLM 根据工具定义中的 `required` 字段自动判断缺什么就问什么。

### 和传统客服 Bot 的对比

| 维度 | 传统规则 Bot | Agent 模式 |
|------|-------------|-----------|
| **意图识别** | 分类模型（训练数据 + 规则） | LLM 通过 Prompt 理解 |
| **槽位填充** | 独立的 NER 模型 | LLM 从对话中自动提取 |
| **对话管理** | 有限状态机（写死流程） | LLM 自主决策下一步 |
| **工具调用** | if-else 硬编码 | Function Calling 动态路由 |
| **扩展新功能** | 加规则 + 改代码 + 重训练 | **加一个 tool 定义就行** |
| **处理模糊问题** | "对不起，我没听懂" | LLM 自然语言追问 |

---

## 范式 2：ReAct（推理 + 行动循环）

ReAct = **Re**asoning + **Act**ing。Agent 不是一次性决策，而是循环执行"思考→行动→观察"直到任务完成。

### 核心循环

```mermaid
flowchart TD
    Q["用户提问"] --> T["Thought<br/>思考: 我需要做什么?"]
    T --> A["Action<br/>行动: 调用某个工具"]
    A --> O["Observation<br/>观察: 工具返回了什么?"]
    O -->|"任务未完成"| T
    O -->|"任务完成"| R["Final Answer<br/>输出最终回复"]
```

### 和意图路由的区别

意图路由是**一次性判断**：分类 → 调一个工具 → 返回。ReAct 是**多步循环**：可能需要调多个工具、前一步的结果影响下一步的决策。

```
用户: "帮我比较一下 iPhone 16 和 Galaxy S26 哪个值得买"

Thought 1: 我需要先查两款手机的参数
Action 1:  search_product("iPhone 16") → 拿到价格、配置
Observation 1: iPhone 16, A18芯片, 6.1寸, ¥6,999

Thought 2: 再查另一款
Action 2:  search_product("Galaxy S26") → 拿到价格、配置
Observation 2: Galaxy S26, 骁龙8Gen4, 6.2寸, ¥6,499

Thought 3: 用户说"值得买"，可能关心性价比，我再查下评价
Action 3:  search_reviews("iPhone 16 vs Galaxy S26")
Observation 3: 综合评测数据...

Thought 4: 信息够了，可以给出对比建议
Final Answer: "两款手机对比如下：..."
```

**Claude Code 就是 ReAct 范式**——读代码 → 思考 → 改代码 → 跑测试 → 看结果 → 再改，循环直到完成。

### 实现要点

```python
# ReAct 的核心 Prompt 模板
REACT_PROMPT = """请按以下格式思考和行动：

Thought: 分析当前状况，决定下一步做什么
Action: 工具名(参数)
Observation: [工具返回结果，由系统填入]
... (可以重复多轮 Thought/Action/Observation)
Thought: 我已经有足够的信息了
Final Answer: 最终回复
"""
```

**框架支持**：LangChain 的 `create_react_agent`、LlamaIndex 的 `ReActAgent` 都内置了 ReAct 循环。

---

## 范式 3：Plan-and-Execute（先规划再执行）

面对复杂任务时，先让一个 Planner LLM 生成整体计划，再让 Executor 逐步执行。

### 架构

```mermaid
flowchart TD
    U["用户: 帮我做一个商品比价报告"] --> P["Planner<br/>(规划器)"]
    P --> Plan["生成计划:<br/>1. 抓取 A 平台价格<br/>2. 抓取 B 平台价格<br/>3. 数据对齐<br/>4. 生成对比表<br/>5. 写总结建议"]
    Plan --> E1["Executor 执行步骤1"]
    E1 --> E2["Executor 执行步骤2"]
    E2 --> E3["Executor 执行步骤3"]
    E3 --> E4["Executor 执行步骤4"]
    E4 --> E5["Executor 执行步骤5"]
    E5 --> R["输出最终报告"]

    E3 -.->|"步骤失败"| RP["Replanner<br/>重新规划剩余步骤"]
    RP -.-> E3
```

### 和 ReAct 的区别

| 维度 | ReAct | Plan-and-Execute |
|------|-------|-----------------|
| **决策方式** | 每一步都临场判断 | 先做全局规划，再逐步执行 |
| **适合任务** | 步骤不确定、需要灵活应对 | 步骤可预见、需要系统化执行 |
| **失败处理** | 重新思考下一步 | Replanner 重新规划剩余步骤 |
| **典型产品** | ChatGPT Plugins、Claude Code | Devin、AutoGPT |
| **类比** | 走迷宫时走一步看一步 | 先看地图规划路线再出发 |

### 实际例子：Devin 的工作方式

```
用户: "帮我搭建一个博客网站，要支持暗色模式"

Planner 输出:
  Step 1: 初始化 Next.js 项目
  Step 2: 安装 Tailwind CSS
  Step 3: 创建首页布局组件
  Step 4: 创建文章列表页
  Step 5: 创建文章详情页
  Step 6: 实现暗色模式切换
  Step 7: 添加 SEO 元数据
  Step 8: 本地运行验证

Executor 逐步执行:
  Step 1: ✅ npx create-next-app@latest blog
  Step 2: ✅ 安装 Tailwind（用 CLI 工具）
  Step 3: ✅ 创建 Layout.tsx
  Step 4: ❌ 文章列表接口报错
  → Replanner: 修改 Step 4 为"使用本地 markdown 文件代替 API"
  Step 4(重试): ✅ 读取 /posts/*.md 渲染列表
  Step 5-8: ✅ 逐步完成
```

---

## 范式 4：Multi-Agent（多 Agent 协作）

多个 Agent 各司其职，通过消息传递协作完成复杂任务。已有的 [OpenAI Agents SDK 笔记](<./OpenAI Agents SDK 与多角色协作.md>) 详细讲了 Handoff 机制，这里总结两种常见编排模式。

### 编排模式 A：接力式（Pipeline）

Agent 之间线性传递，每个 Agent 完成自己的部分后移交给下一个：

```mermaid
graph LR
    A["需求分析 Agent"] -->|handoff| B["架构设计 Agent"]
    B -->|handoff| C["编码 Agent"]
    C -->|handoff| D["测试 Agent"]
    D -->|"发现bug"| C
    D -->|"通过"| E["完成"]
```

**代表**：OpenAI Agents SDK 的 Handoff 机制。

### 编排模式 B：中心调度式（Orchestrator）

一个 Orchestrator Agent 负责分发任务，子 Agent 各自执行后汇报结果：

```mermaid
graph TD
    O["Orchestrator<br/>(调度中心)"] --> A1["搜索 Agent<br/>检索相关资料"]
    O --> A2["分析 Agent<br/>处理数据"]
    O --> A3["写作 Agent<br/>生成报告"]
    A1 -->|"搜索结果"| O
    A2 -->|"分析结论"| O
    A3 -->|"报告初稿"| O
    O --> F["整合输出"]
```

**代表**：Claude Code 的子 Agent 模式——主 session 分派任务给子 Agent，子 Agent 干完活回来汇报。

### 两种模式对比

| | 接力式 | 中心调度式 |
|------|--------|-----------|
| **上下文** | 完整对话历史传递 | 子 Agent 各自独立上下文 |
| **并行性** | 串行执行 | 可并行分派 |
| **适合** | 流程明确的流水线任务 | 需要多角色同时工作的任务 |

### 生产实战：Anthropic Research（Orchestrator-Worker 旗舰案例）

Anthropic 把 **Research** 功能（Claude.ai 网页/桌面版的"深度研究"模式）做成了 Sub-Agent 架构的旗舰演示。

**业务场景**：用户问一个需要多源调研的复杂问题——
- "过去一年开源 LLM 推理框架的格局变化"
- "竞品 X 的定价策略演变"
- "向量数据库主要玩家的融资 + 用户增长"

传统 RAG 是 search → top-k → summary，遇到这种"需要交叉验证 + 多视角综合"的问题就力不从心。Anthropic Research 改成 Orchestrator-Worker：

```mermaid
flowchart TD
    Q["用户问题<br/>过去一年 LLM 推理框架格局"] --> Lead["Lead Researcher<br/>(Orchestrator)"]
    Lead -->|拆问| S1["Sub-Agent 1<br/>市场份额 + 用户增长"]
    Lead -->|并行| S2["Sub-Agent 2<br/>主要玩家融资动态"]
    Lead -->|并行| S3["Sub-Agent 3<br/>开源生态 + commit 活跃度"]
    Lead -->|并行| Sn["Sub-Agent N<br/>价格 / 性能基准"]
    S1 -->|结构化摘要 + 引文| Lead
    S2 -->|结构化摘要 + 引文| Lead
    S3 -->|结构化摘要 + 引文| Lead
    Sn -->|结构化摘要 + 引文| Lead
    Lead --> Cite["Citation Agent<br/>补全引用、查 dead link"]
    Cite --> Report["最终报告<br/>5-15 页，带 inline citation"]
```

**为什么是 Sub-Agent 而非单 agent 跑长链**：

| 单 agent 长链 | Sub-Agent 并行（Anthropic 选择） |
|---|---|
| context window 越填越满，后期信息丢失 | 每个子任务在自己的小 context 里专注 |
| 串行总耗时 30+ 分钟 | 并行 5-10 分钟 |
| 一处搜索失败拖累全局 | 失败隔离：单个 sub-agent 挂了不影响其他 |
| 引用难追溯（混在长 chain 里） | 每条事实带 sub-agent id + fetch 时间戳 |
| context 难复用 | Lead 只接收摘要，自己 context 不会被中间过程污染 |

**业务价值**：

- 把"分析师 1-2 小时人工调研"压缩到 **5-10 分钟**
- 输出**带 citation 可验证**——每个论断点击能跳到具体来源
- 是 Anthropic 当下力推的"Claude 能做工作而不只是聊天"的旗舰演示

**对应到本范式分类**：Anthropic Research 是 Orchestrator-Worker（中心调度式）的最大规模生产实例。Worker 之间无依赖、可并行、各自独立 context——这三个特征是 Orchestrator-Worker 高效的前提，也是判断"我的需求适不适合这套架构"的检查清单。

**借鉴价值（自己做类似系统）**：
- 拆问能力是关键——Lead Researcher 的 system prompt 决定了拆得好不好（粒度太粗 → 子 agent context 还是会爆；太细 → 子 agent 之间信息冗余）
- Citation Agent 单独成 agent 而非内嵌——"引用补全 + 死链检查"是独立职责，混在 Lead 里会污染综合逻辑
- 子 agent 数量动态——简单问题 2-3 个 worker，复杂问题 8-10 个，靠 Lead 自己判断

---

> 回到导览页：[agent-development-practice](<./Agent 开发实战：选型、框架与思维转换.md>) — 范式选型、主流框架速查、学习路径、Agent 开发 vs 传统 Java 应用六维对比
