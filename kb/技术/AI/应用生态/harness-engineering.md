---

tags: [ai, agent, harness-engineering, prompt-engineering, context-engineering]
related:
  - kb/技术/AI/应用生态/agent-development-practice.md
  - kb/技术/AI/应用生态/claude-code-architecture.md
  - kb/技术/AI/大模型/llm-agent-mcp.md
description: "Harness Engineering(驾驭工程)：Agent=Model+Harness、六项核心能力、四阶段成长路径、与Prompt/Context Engineering对比"
---

# Harness Engineering：AI Agent 时代的工程范式

> 最后整理: 2026-05-12 | 来源: 对话讨论

## 什么是 Harness Engineering

Harness Engineering（驾驭工程）是 2026 年初火起来的新概念，继 Prompt Engineering 之后的下一代工程范式。

**一句话定义**：围绕 AI Agent 构建的约束、反馈与控制系统，让 Agent 在人类设定的边界内自主、可靠地工作。

### 核心公式

```
Agent = Model + Harness

Model  → LLM 本身（Claude/GPT 等），你控制不了它怎么思考
Harness → 模型之外的一切工程基础设施，你能控制的部分
```

```mermaid
flowchart TD
    subgraph "Harness（你能控制的）"
        A["上下文构建<br/>给 Agent 看什么"]
        B["工具定义<br/>Agent 能做什么"]
        C["约束规则<br/>Agent 不能做什么"]
        D["反馈回路<br/>怎么知道 Agent 做对没"]
        E["记忆管理<br/>Agent 记住什么忘记什么"]
        F["安全护栏<br/>出错时怎么兜底"]
    end
    
    subgraph "Model（你控制不了的）"
        M["LLM 推理"]
    end
    
    A --> M
    B --> M
    C --> M
    M --> D
    D -->|"反馈调整"| A
    E --> A
    F --> M
```

### 用本知识库项目举例

CLAUDE.md 就是 Harness 的一部分：

| Harness 组件 | 对应实现 | 作用 |
|-------------|---------|------|
| **上下文构建** | CLAUDE.md 中的项目规则 | 告诉 Agent 项目结构、文件组织规则 |
| **工具定义** | `build-index.js`、`lint.sh` | Agent 可调用的工具 |
| **约束规则** | "不要手改 overview.html"、"子目录最多两层" | 限制 Agent 不能做什么 |
| **反馈回路** | `exit-check.sh`、`check-overview.js` | 执行后自动检查产出 |
| **记忆管理** | `memory/` 目录下的 feedback 文件 | 跨会话记住用户偏好和教训 |
| **安全护栏** | markdownlint 格式检查 | 防止产出不合规内容 |

### 和之前概念的关系

```
Prompt Engineering   → 怎么写好一句话让 LLM 回答好
Context Engineering  → 怎么把正确的信息喂给 LLM
Harness Engineering  → 怎么设计整个系统让 Agent 可靠工作
```

| 维度 | Prompt Engineering | Context Engineering | Harness Engineering |
|------|-------------------|--------------------|--------------------|
| **关注点** | 一次对话写好 | 每次输入信息完整 | 整个 Agent 系统 |
| **范围** | System Prompt | Prompt + 检索内容 | Prompt + 工具 + 约束 + 反馈 + 记忆 + 护栏 |
| **迭代方式** | 改 Prompt 措辞 | 改检索策略 | 改系统架构 |
| **类比** | 写一封好的邮件 | 整理好参考资料 | 设计整套工作流程 |

### 为什么现在火了

Agent 不可靠的原因，80% 不是模型不够聪明，而是 Harness 没设计好：

```
常见 Agent 失败原因:
  ❌ "模型太笨了"        → 其实是上下文没给对
  ❌ "Agent 乱调工具"    → 其实是工具 description 写得不好
  ❌ "Agent 跑偏了"      → 其实是缺少约束规则
  ❌ "Agent 重复犯错"    → 其实是没有记忆和反馈回路
  ❌ "Agent 产出不可控"  → 其实是没有护栏和校验
```

**核心理念：当 Agent 表现不好时，不是换更强的模型，而是改善 Harness。**

实际例子：

```
场景: Agent 写代码总是忘记加单元测试

❌ Prompt 思路: 在 Prompt 加一句 "每次写代码都要写测试"
   → 有时管用，有时 Agent 就是忘

✅ Harness 思路:
   1. 工具约束: "运行测试"设为必选工具，提交前自动执行
   2. 反馈回路: 提交后自动跑 CI，不通过自动打回
   3. 记忆机制: 写进 CLAUDE.md，每次会话自动加载
   4. 护栏检查: exit-check.sh 检查是否有新增测试文件
   → 系统性保证，不依赖 Agent "记得住"
```

---

## Harness 工程师的六项核心能力

```mermaid
graph TD
    H["Harness 工程师"] --> C1["① 上下文设计"]
    H --> C2["② 工具设计"]
    H --> C3["③ 约束与护栏"]
    H --> C4["④ 反馈回路"]
    H --> C5["⑤ 诊断与调优"]
    H --> C6["⑥ 系统思维"]
    
    style C1 fill:#d4edda
    style C2 fill:#cce5ff
    style C3 fill:#fff3cd
    style C4 fill:#f8d7da
    style C5 fill:#e2d5f1
    style C6 fill:#d1ecf1
```

### ① 上下文设计——给 Agent 看什么

上下文不是越多越好，而是要精准：

```
❌ 差: 把整个代码库全塞给 Agent → 信息过载，注意力稀释
✅ 好: 精心设计 CLAUDE.md → 项目结构、规范、规则一目了然
```

### ② 工具设计——让 Agent 能做什么

- 粒度合适：太粗 LLM 不知道什么时候用，太细 LLM 选择困难
- description 即 API 文档：LLM 只看 description 决策
- 返回值要充足：返回 `success` 不够，要返回完整的上下文信息

### ③ 约束与护栏——让 Agent 不能做什么

**区分初级和高级 Harness 工程师的关键**——初级只想让 Agent 能做事，高级考虑怎么让 Agent 不出事。

```
三类约束:
  硬约束（代码强制）→ 退款金额 > 订单金额直接拒绝，不依赖 LLM
  软约束（Prompt 引导）→ "输出前检查隐私信息"，大部分遵守
  兜底机制（出错补救）→ 输出后用正则/小模型二次校验
```

### ④ 反馈回路——怎么知道 Agent 做对没

没有反馈的 Agent 就像没有测试的代码——看起来能跑，但不知道对不对。

```mermaid
flowchart LR
    A["Agent 执行"] --> B["自动检查<br/>lint/test/规则校验"]
    B -->|"通过"| C["产出交付"]
    B -->|"未通过"| D["反馈 Agent<br/>自动重试"]
    D --> A
    C --> E["人工抽检"]
    E -->|"发现问题模式"| F["改善 Harness"]
    F --> A
```

### ⑤ 诊断与调优——Agent 出问题怎么排查

```
Agent 表现不好 →
  1. 看上下文: Agent 拿到足够信息了吗？ → 补 CLAUDE.md / 工具返回值
  2. 看工具: 选对工具了吗？参数对吗？   → 改 description / 合并工具
  3. 看约束: 做了不该做的事吗？          → 加硬约束 / 加护栏
  4. 看反馈: Agent 知道自己做错了吗？     → 加检查脚本 / 加测试
  5. 最后才考虑: 模型能力不够？           → 这通常是最后手段
```

### ⑥ 系统思维——全局设计能力

优秀的 Harness 工程师设计的是可持续迭代的系统：可复用、可演化、可度量。

---

## 成长路径：四个阶段

```mermaid
graph TD
    L1["L1: Prompt 调优者<br/>能写好 System Prompt"] --> L2
    L2["L2: 工具构建者<br/>能设计和实现 Agent 工具"] --> L3
    L3["L3: 系统设计者<br/>能设计完整 Harness 体系"] --> L4
    L4["L4: 平台架构师<br/>能搭建可复用 Harness 平台"]
    
    L1 ---|"跃迁: 从写 Prompt 到写工具"| L2
    L2 ---|"跃迁: 从单工具到整体系统"| L3
    L3 ---|"跃迁: 从一个项目到多个项目"| L4
    
    style L1 fill:#d4edda
    style L2 fill:#cce5ff
    style L3 fill:#fff3cd
    style L4 fill:#f8d7da
```

| 阶段 | 能做什么 | 核心技能 |
|------|---------|---------|
| **L1 Prompt 调优者** | 写好 System Prompt，单次任务表现好 | Prompt Engineering、Few-shot |
| **L2 工具构建者** | 设计 Function Calling 工具、理解工具粒度 | 工具设计、API 设计、Agent 框架 |
| **L3 系统设计者** | 设计完整 Harness（上下文+工具+约束+反馈+记忆） | 系统思维、反馈回路、可观测性 |
| **L4 平台架构师** | 搭建可复用的 Harness 平台，服务多项目/团队 | 平台工程、标准化、Eval 体系 |

### 各阶段跃迁的具体技能

**L1 → L2（从 Prompt 到工具）**：

- 理解 Function Calling 完整机制
- 能用 Spring AI / LangChain 实现带工具调用的 Agent
- 理解 description 对 LLM 决策的影响
- 能设计合理的工具粒度和参数

**L2 → L3（从工具到系统）**：

- 能设计 CLAUDE.md / AGENTS.md 级别的上下文规范
- 能搭建自动化检查链路（lint → test → review）
- 能设计记忆机制（跨会话知识持久化）
- 能做 Agent 行为的可观测性（日志、链路追踪）
- 能做 Agent 产出的质量评估（eval 框架）

**L3 → L4（从项目到平台）**：

- 能设计可复用的 Harness 模板（如 Superpowers Skill 体系）
- 能搭建 Agent Eval 平台（自动化评估不同任务上的表现）
- 能设计 Harness 的版本管理和 A/B 测试
- 能输出团队级别的 Harness 最佳实践

> 关联: [Agent 开发实战](./agent-development-practice.md) — 四大设计范式、vs 传统 Java 开发
> 关联: [Claude Code 架构](./claude-code-architecture.md) — Claude Code 的 Harness 实现（REPL 循环、工具链、上下文管理）
> 关联: [Agent 与 MCP](../大模型/llm-agent-mcp.md) — MCP 协议、Skill 概念
