---
title: "Agent 开发实战：设计范式与落地实践"
tags: [ai, agent, function-calling, intent-routing, tool-use, react, plan-execute, multi-agent]
related:
  - kb/技术/AI/大模型/llm-agent-mcp.md
  - kb/技术/AI/应用生态/openai-agents-sdk.md
  - kb/技术/AI/应用生态/llm-customer-service.md
  - kb/技术/Java/spring-ai.md
  - kb/技术/AI/应用生态/ai-coding-team-governance.md
description: "Agent开发实战：四大设计范式、vs传统Java开发六维对比、工具设计六要点、测试/可观测/成本模型差异"
---

# Agent 开发实战：设计范式与落地实践

> 最后整理: 2026-05-09 | 来源: 对话讨论

## Agent 开发的四大设计范式

开发一个 Agent 系统，不同的任务复杂度适合不同的架构范式。下面从简单到复杂排列：

```mermaid
graph LR
    P1["范式1<br/>意图路由<br/>(Router)"] -->|"任务更复杂"| P2["范式2<br/>ReAct<br/>(推理+行动)"]
    P2 -->|"任务需要规划"| P3["范式3<br/>Plan-Execute<br/>(先规划再执行)"]
    P3 -->|"任务需要多角色"| P4["范式4<br/>Multi-Agent<br/>(多Agent协作)"]
    
    style P1 fill:#d4edda
    style P2 fill:#cce5ff
    style P3 fill:#fff3cd
    style P4 fill:#f8d7da
```

| 范式 | 适合场景 | 典型产品 | 复杂度 |
|------|---------|---------|--------|
| **意图路由** | 客服答疑、FAQ 查询 | 各类客服 Bot | ★☆☆☆ |
| **ReAct** | 需要多步推理+工具调用 | Claude Code、ChatGPT Plugins | ★★☆☆ |
| **Plan-Execute** | 复杂任务需要先规划再执行 | Devin、AutoGPT | ★★★☆ |
| **Multi-Agent** | 多角色协作的大型任务 | OpenAI Agents SDK、CrewAI | ★★★★ |

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
  Step 2: ✅ npm install tailwindcss
  Step 3: ✅ 创建 Layout.tsx
  Step 4: ❌ 文章列表接口报错
  → Replanner: 修改 Step 4 为"使用本地 markdown 文件代替 API"
  Step 4(重试): ✅ 读取 /posts/*.md 渲染列表
  Step 5-8: ✅ 逐步完成
```

---

## 范式 4：Multi-Agent（多 Agent 协作）

多个 Agent 各司其职，通过消息传递协作完成复杂任务。已有的 [OpenAI Agents SDK 笔记](./openai-agents-sdk.md) 详细讲了 Handoff 机制，这里总结两种常见编排模式。

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

---

## 四种范式怎么选

| 你的任务 | 推荐范式 | 原因 |
|---------|---------|------|
| 客服答疑、FAQ 查询 | 意图路由 | 一问一答，不需要多步推理 |
| 信息搜索+汇总 | ReAct | 需要多步搜索、前后步骤有依赖 |
| 搭建一个完整项目 | Plan-Execute | 步骤多且可预见，需要全局规划 |
| 复杂的多角色协作 | Multi-Agent | 不同角色有不同专长和工具集 |
| 混合场景 | **组合使用** | 实际产品常常混用多种范式 |

最后一行很重要——**实际产品往往混用**。比如一个智能客服系统可能用意图路由做第一层分类，复杂问题走 ReAct 循环，后台运维任务走 Plan-Execute。

---

## 主流 Agent 开发框架速查

| 框架 | 语言 | 核心范式 | 适合场景 | 上手难度 |
|------|------|---------|---------|---------|
| **Spring AI** | Java | 意图路由 + FC | Java 后端快速接入 | ★☆☆ |
| **LangChain** | Python | ReAct + 工具链 | 通用 Agent 开发 | ★★☆ |
| **LangGraph** | Python | 有状态图 + 多步 | 复杂流程编排 | ★★★ |
| **OpenAI Agents SDK** | Python | Multi-Agent + Handoff | 多角色协作 | ★★☆ |
| **CrewAI** | Python | Multi-Agent + 角色 | 团队模拟协作 | ★★☆ |
| **Dify / Coze** | 低代码 | 可视化编排 | 快速验证想法 | ★☆☆ |

### Java 开发者快速上手示例（Spring AI）

```java
// 1. 用 @Tool 注解定义工具
@Component
public class OrderTools {
    @Tool(description = "查询订单详情，包括状态、金额、物流信息")
    public OrderInfo queryOrder(@Param("订单号") String orderId) {
        return orderService.getById(orderId);
    }
    
    @Tool(description = "发起退款申请")
    public RefundResult applyRefund(
        @Param("订单号") String orderId,
        @Param("退款原因") String reason) {
        return refundService.apply(orderId, reason);
    }
}

// 2. 配置 ChatClient
@Bean
public ChatClient chatClient(ChatModel model, OrderTools tools) {
    return ChatClient.builder(model)
        .defaultSystem(SYSTEM_PROMPT)
        .defaultTools(tools)
        .defaultAdvisors(new MessageChatMemoryAdvisor(memory))
        .build();
}

// 3. Controller
@PostMapping("/chat")
public Flux<String> chat(@RequestBody ChatRequest req) {
    return chatClient.prompt().user(req.getMessage())
        .stream().content();
}
```

---

## Agent 开发的学习路径

```mermaid
graph TD
    L1["第一步: 跑通最小 Agent<br/>Spring AI + 一个工具<br/>(1-2天)"] --> L2
    L2["第二步: 意图路由+多轮对话<br/>Prompt 工程是核心<br/>(1周)"] --> L3
    L3["第三步: ReAct 多步推理<br/>LangChain / LangGraph<br/>(1-2周)"] --> L4
    L4["第四步: Multi-Agent 编排<br/>OpenAI Agents SDK<br/>(持续学习)"]
    
    L1 -.->|"可选"| P1["Dify/Coze 低代码<br/>快速验证想法"]
    L3 -.->|"可选"| P2["RAG 知识库集成<br/>向量数据库+Embedding"]
    L4 -.->|"进阶"| P3["MCP Server 开发<br/>做可复用的工具包"]
    
    style L1 fill:#d4edda
    style L2 fill:#cce5ff
    style L3 fill:#fff3cd
    style L4 fill:#f8d7da
```

| 阶段 | 做什么 | 产出 |
|------|--------|------|
| **第一步** | 做一个"能查数据库的聊天机器人" | 最小可用 demo |
| **第二步** | 加意图路由 + 追问机制 | 客服答疑工具雏形 |
| **第三步** | 实现 ReAct 循环，接 RAG | 能多步推理+查文档回答 |
| **第四步** | 多 Agent 协作 | 复杂任务自动拆分+流转 |

---

## Agent 开发 vs 传统 Java 应用开发

Java 开发者第一次接触 Agent 开发时，容易不自觉地用传统思维套，踩很多坑。最根本的区别在于：

```
传统 Java 应用:
  controller.getOrder("12345") → 永远返回同一个订单数据
  100% 可预测、可复现

Agent 应用:
  用户: "帮我看看上次买的东西到哪了"  
  → 第一次: "您的订单正在配送中，预计今天送达"
  → 第二次: "包裹已到您附近的配送站，马上就到啦"
  → 意思一样，表述不同；甚至可能理解错"上次"指的是哪个订单
```

### 六个核心维度对比

| 维度 | 传统 Java 应用 | Agent 应用 |
|------|---------------|-----------|
| **核心逻辑** | 你写的 if-else / 业务规则 | LLM 推理 + 你写的工具 |
| **输入输出** | 结构化（JSON/表单） | 自然语言（任意表述） |
| **流程控制** | 你定义的流程图 | LLM 自主决策下一步 |
| **测试方法** | 断言精确结果 | 模糊匹配 + 人工评估 |
| **调试方式** | 看日志 + 断点 | 看 Prompt + LLM 输出链路 |
| **核心技能** | 写代码 | 写 Prompt + 设计工具 |

### 用"退款"场景看区别

**传统 Java——你控制整个流程：**

```java
@PostMapping("/refund")
public Result applyRefund(@RequestBody RefundRequest req) {
    if (req.getOrderId() == null) throw new BadRequest("缺少订单号");
    Order order = orderService.getById(req.getOrderId());
    if (order.getStatus() != DELIVERED) 
        throw new BizException("未签收不可退款");
    if (daysBetween(order.getDeliverTime(), now()) > 7)
        throw new BizException("超过7天退款期");
    refundService.apply(order, req.getReason());
    return Result.success("退款申请已提交");
}
```

**Agent——你只提供"能力"，LLM 决定调用顺序：**

```java
@Tool(description = "查询订单详情，返回状态、金额、签收时间")
public OrderInfo queryOrder(@Param("订单号") String orderId) {
    return orderService.getById(orderId);
}

@Tool(description = "发起退款，仅限已签收且在7天内的订单")
public RefundResult applyRefund(
    @Param("订单号") String orderId,
    @Param("退款原因") String reason) {
    // 业务校验仍然在工具内部！
    Order order = orderService.getById(orderId);
    if (order.getStatus() != DELIVERED) 
        return RefundResult.fail("该订单未签收，暂不支持退款");
    if (daysBetween(order.getDeliverTime(), now()) > 7)
        return RefundResult.fail("已超过7天退款期");
    refundService.apply(order, reason);
    return RefundResult.success("退款申请已提交");
}
// 先查订单还是直接退款？由 LLM 自己判断
```

### 六个设计要点

#### 1. 工具描述决定一切

LLM 通过工具的 description 决定什么时候调什么工具。description 写不好，LLM 就会选错工具或传错参数。

```java
// ❌ 差——LLM 不知道什么时候该用
@Tool(description = "查询数据")
public Object query(String param) { ... }

// ✅ 好——明确用途、参数格式、限制条件
@Tool(description = "查询订单详情，包括状态、金额、物流。" +
     "需要订单号（格式如 2026050100123）。" +
     "如果用户没提供订单号，请先询问。")
public OrderInfo queryOrder(@Param("订单号，纯数字") String orderId) { ... }
```

#### 2. 业务校验必须在工具内部

```java
// ❌ 危险：靠 Prompt 告诉 LLM "超过7天不能退"
//    LLM 可能忘记、可能算错天数、可能被 Prompt 注入绕过

// ✅ 安全：工具内部硬编码校验
@Tool(description = "发起退款申请")
public RefundResult applyRefund(String orderId, String reason) {
    Order order = orderService.getById(orderId);
    if (daysBetween(order.getDeliverTime(), now()) > 7) {
        return RefundResult.fail("已超过7天退款期");
    }
    // ...
}
```

**原则：LLM 负责理解意图和组织语言，业务规则和数据校验走传统代码路径。**

#### 3. 测试方式完全不同

```java
// 传统：精确断言
assertEquals("退款申请已提交", result.getMessage());

// Agent：模糊评估——LLM 每次措辞不同
assertTrue(response.contains("退款") || response.contains("退货"));
verify(refundService).apply(any(), any());  // 验证工具确实被调用了
```

**Agent 测试三层**：工具单测（和传统一样）→ 路由测试（LLM 是否选对工具）→ 端到端评估（人工或 eval 框架）

### 团队级质量保障：Pre-PR 与 AI 辅助测试

当团队 90% 代码由 AI 生成时，测试策略也需要升级。美团在 31 万行代码重构中沉淀了两套互补机制：

**Pre-PR（预审）机制**：

```
传统流程: 编码 → 提交 PR → Reviewer 从头看到尾
Pre-PR:   编码 → AI 自查多轮 → 修复AI能发现的问题 → AI生成PR文档 → 人工CR聚焦业务语义
```

人工 CR 的价值从"你写得对吗？"转变为"我们是否在正确的约束下解决正确的问题？"

**AI 辅助测试 SOP（Human-in-the-loop 模式）**：

团队尝试了两条路线：
- **路线 A（AI 全自动）**：AI 读 PRD + diff → 全自动生成用例 → 人最后把关 → **失败**：AI 缺乏全局业务认知，容易漏掉隐性高危场景，同时发散大量无价值边缘用例
- **路线 B（人主导 + AI 辅助）✅**：人定范围、判风险 → AI 扫描代码、生成用例 → 人 review 确认

路线 B 的 5 步 SOP：

| 步骤 | 人做什么 | AI 做什么 |
|------|---------|----------|
| 1. 建立范围 | 审核确认测试范围 | 从流量 + 代码变更双向扫描受影响接口 |
| 2. 风险分级 | 判定风险等级，决定测试深度 | 读代码回答：改了多少、分支在哪、旧数据兼容吗 |
| 3. 设计分组 | 审核分组，补充业务特殊场景 | 判定表方法"先拆后合"，自动生成最小 Case 组合 |
| 4. 生成步骤 | 校验步骤匹配度，补充边界 | 按"一步操作、多维验证"模板展开 |
| 5. 验证覆盖 | 最终确认无盲区 | 自动生成接口×维度覆盖矩阵，标记未覆盖项 |

**核心原则**：AI 负责"生成"和"扫描"（体力活），人负责"判断"和"确认"（需要业务认知），每步都有 Human-in-the-loop。

> 关联: [AI Coding 团队治理](./ai-coding-team-governance.md) — Pre-PR 机制详解 + 完整 5 步测试 SOP 表格

#### 4. 可观测性要求更高

传统应用看日志就够了。Agent 应用需要完整记录：

- 完整 Prompt（system + user + history）
- 工具调用链路（名称 + 参数 + 返回值）
- LLM 原始输出
- 模型版本、temperature、token 消耗

#### 5. 错误处理返回描述而非异常

```java
// 传统：抛异常，前端展示错误码
throw new BizException(ErrorCode.ORDER_NOT_FOUND, "订单不存在");

// Agent：返回描述性错误，让 LLM 自然语言告诉用户
if (order == null) {
    return OrderInfo.error("未找到订单 " + orderId + "，请确认订单号是否正确");
}
```

#### 6. 成本模型完全不同

```
传统: 成本 ≈ 服务器资源，和输入长度基本无关
Agent: 成本 ≈ token 消耗，按输入+输出字数计费

第 1 轮对话:  ~500 tokens ≈ ¥0.01
第 20 轮对话: ~10000 tokens ≈ ¥0.2  ← 单轮成本涨了 20 倍
```

需要做上下文管理：滑动窗口、摘要压缩、关键信息提取。

### 思维转换总结

```
传统 Java 开发者: 我控制一切 → 我定义流程 → 我处理所有分支 → 确定结果
Agent 开发者:     我提供能力 → LLM 决定顺序 → 我兜底业务规则 → 正确但不同的结果

从"流程控制者"变成"能力提供者 + 兜底守门员"
```

> 关联: [Agent 与 MCP](../大模型/llm-agent-mcp.md) — Agent 循环、MCP 协议、FC 机制的概念原理
> 关联: [OpenAI Agents SDK](./openai-agents-sdk.md) — 多角色协作与 Handoff 机制
> 关联: [LLM 智能客服实战](./llm-customer-service.md) — 从零搭建客服系统全流程
> 关联: [LLM 应用设计](./llm-app-design.md) — 确定性 vs 概率性、上下文管理、幻觉防控
> 关联: [Spring AI](../../Java/spring-ai.md) — Spring 生态的 LLM 集成
