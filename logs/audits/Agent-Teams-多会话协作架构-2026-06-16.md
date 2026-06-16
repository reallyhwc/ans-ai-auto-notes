---
audit_target: kb/技术/AI/Claude-Code/Agent Teams 多会话协作架构.md
audit_date: 2026-06-16
verdict: minor
---

# Audit: Agent Teams 多会话协作架构.md

## 1. 深度与具象度 [⚠]

- **强项**：§5 四大设计模式各有 Mermaid 图 + 启动 prompt 示例，尤其"竞争假设"和"规划-审批"的 prompt 可直接复制使用。§6 全栈 Bug 猎人案例给出了完整的级联故障链（4 个 bug 互为因果）和实际 prompt，具象度高。
- **强项**：§7 选型决策树 + 维度对比表 + 一句话决策，形成完整的决策框架。
- **弱项**：§8 Token 成本只说"显著高于"，没有量化参考（如 3 个 Teammates 大约是单 session 的几倍成本）。对于选型决策来说，缺少量化数据会让读者难以判断"贵多少，值不值"。
- **弱项**：§3 提到 `~/.claude/teams/{team-name}/config.json` 和 `members` 数组，但没有展示实际内容结构。读者无法直观理解"Teammates 如何通过 config 发现彼此"。

## 2. 论述流畅性 + 章节逻辑 [⚠]

- **主线清晰**：§1 定位 → §2-4 机制细节 → §5 设计模式 → §6 实战 → §7-8 选型/成本 → §9 最佳实践 → §10-12 补充。从"是什么"到"怎么用"到"该不该用"的递进合理。
- **问题 1**：§10"与 Multi-Agent 架构的关系"只有一张 4 行对比表 + 一个链接，内容过于单薄。它回答的是"Agent Teams 和应用层 Multi-Agent 的区别"，这个问题值得展开（如 Agent Teams 的协作模式如何映射到生产系统的 Supervisor/Router 模式），或者合并到 §7 选型部分。
- **问题 2**：§12"本项目目前的应用状态"+ 附"Claude Code 官方最佳实践补充"作为收尾显得松散。§12 是好的自省内容但 3 个 bullet 太短；附录只有 3 条泛泛而谈的内容，不如并入 §9 最佳实践。
- **问题 3**：`从 Sub-Agent 到 Multi-Agent 的工程指南.md` 的 §10（第 729-843 行）有一份非常详细的 Agent Teams 覆盖（架构、对比、开启方式、角色定义、显示模式、最佳实践、限制），与本文件存在显著内容重叠。两个文件都在讲 Agent Teams，边界不清，未来维护时容易不一致。

## 3. 链接与双向关联语义 [⚠]

- **正向链接完备**：引用了 4 个关联文件（subagents / 并行探索 / Multi-Agent 指南 / Harness Engineering），语义均相关。
- **双向链接缺失严重**：
  - `并行探索与流水线编排.md`：完全未提及 Agent Teams（grep 零匹配）。Agent Teams 的"模块化开发"模式与并行编排直接相关，应补反向链接。
  - `子智能体（subagents）机制与实战.md`：仅在 §13 决策树中有一个 "agent teams" 文本提及（第 516 行），但无 markdown 链接指向本文件。
  - `从 Sub-Agent 到 Multi-Agent 的工程指南.md`：其 §10 详细讨论了 Agent Teams（含架构、对比、配置），但没有链接回本文件。考虑到本文件是 Agent Teams 的专题文件，那里应当加"详见"链接。
  - `Harness Engineering：AI Agent 时代的工程范式.md`：在第 528-537 行提到了 Agent Teams（含对比表），但无链接指向本文件。
- **源权威冲突**：Multi-Agent 指南 §10 和本文件覆盖相同主题，但互相之间没有链接来告诉读者"哪个是权威源"。

## 4. 视觉化 + Frontmatter 质量 [✓]

- **Frontmatter 质量好**：title "Agent Teams 多会话协作架构"准确；description 详细列出 7 个关键词（Lead+Teammates、互相通信、四大协作设计模式、选型决策树、Token 成本、最佳实践），搜索友好。
- **Mermaid 使用恰当**：9 个 Mermaid 图覆盖了多种类型——graph TB（架构对比）、stateDiagram-v2（生命周期）、flowchart（4 个设计模式 + 决策树 + 级联故障链）、sequenceDiagram（规划-审批）。每张图都承载了文字难以表达的拓扑/时序信息，不是凑数。
- **表格清晰**：6 张表格（创建方式、组件、Bug 猎人对比、Sub-Agents vs Agent Teams 维度对比、最佳实践、Multi-Agent 对比），每张都服务于结构化信息的呈现。
- **代码示例**：7 个非 Mermaid 代码块（JSON 配置、bash、text prompt），其中启动 prompt 示例尤其实用。但缺少 config.json 的实际内容示例。

## 行动建议（按优先级）

1. **Important**: 给 `并行探索与流水线编排.md`、`子智能体（subagents）机制与实战.md`、`从 Sub-Agent 到 Multi-Agent 的工程指南.md` 补上指向本文件的双向链接。特别是 Multi-Agent 指南 §10 应加 `> 详见: [Agent Teams 多会话协作架构](<./Agent Teams 多会话协作架构.md>) — Agent Teams 专题笔记`。
2. **Important**: 与 `从 Sub-Agent 到 Multi-Agent 的工程指南.md` §10 划清边界——建议在 Multi-Agent 指南 §10 保留简要概述 + 链接到本文件，避免两处维护相同内容导致不一致。
3. **Minor**: §8 Token 成本补充量化参考（如"3 个 Teammates ≈ 单 session 5-8 倍 token 消耗，因为每个 Teammate 有独立 context window + 消息通信开销"）。
4. **Minor**: §3 补一个 config.json 结构示例，展示 members 数组的实际字段。
5. **Minor**: §10 和 §12 + 附录内容整合——§10 要么展开要么并入 §7；§12 + 附录并入 §9 或独立成更充实的一节。
6. **Minor**: 给 `Harness Engineering：AI Agent 时代的工程范式.md` 补上指向本文件的反向链接。
