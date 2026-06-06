---
audit_target: kb/技术/AI/Claude-Code/从 Sub-Agent 到 Multi-Agent 的工程指南.md
audit_date: 2026-06-06
verdict: minor
---
# Audit: 从 Sub-Agent 到 Multi-Agent 的工程指南.md

## 1. 深度与具象度 [⚠]
- 四种模式的概念讲解、对比表格、适用场景和局限性分析都很扎实，"现实类比"段帮助建立直觉。生产部署实例（电商客服/代码 Review/企业知识助手）给出了具体的技术栈选型（Haiku/Sonnet/Opus 分层、Kafka/Redis/K8s 部署），属于中高深度。
- 不足：作为"工程指南"，全篇缺乏可运行的代码 demo。没有 Agent SDK 的 spawn 调用示例、没有 Supervisor prompt 模板、没有 Router 分类器伪代码。相比之下同目录的"子智能体机制与实战"有实际 spawn 代码。建议至少在 §3 或 §5 补一段 Agent SDK 的 Supervisor 编排伪代码（或引用 Headless 模式文件中的 SDK 用法）。
- 课后题分析（§7）的逐一排除法论证有力，属于深度达标的部分。

## 2. 论述流畅性 + 章节逻辑 [✓]
- 七个章节的递进关系清晰：引入四模式(§1) → 选型决策树(§2) → 深入最常用模式(§3) → 区分本地 vs 生产(§4) → 生产实例(§5) → 应用到自身项目(§6) → 课后练习巩固(§7)。从抽象到具体、从通用到个人，教学法上属于典型的"金字塔结构"。
- 章节编号 §1-§7 连续无跳号，子节编号（1.1-1.4）也完整。
- 没有明显重复段落或内容散乱点。§4 单独抽出"本地 vs 生产"这个认知差异是很好的决策——它回答了"学完四种模式后我在 Claude Code 里做的到底算什么"这个核心困惑。

## 3. 链接与双向关联语义 [⚠]
- 语义关联性：4 个出站链接都语义合理——子智能体文件是底层机制、Skills 文件对应模式之一、Headless/SDK 对应生产运行时、Agent 开发实战提供更广视角。
- 双向链接缺失：仅"子智能体（subagents）机制与实战.md"已补齐回链。以下 3 个文件缺少指向本文的反向关联：
  1. `Skills 渐进式披露架构.md` — 应补 "关联: 从 Sub-Agent 到 Multi-Agent 的工程指南 — Skills 在多智能体光谱中的定位"
  2. `Headless 模式与 Agent SDK.md` — 应补 "关联: 从 Sub-Agent 到 Multi-Agent 的工程指南 — 生产 Multi-Agent 与 SDK 的关系"
  3. `Agent 开发实战：选型、框架与思维转换.md` — 应补 "关联: 从 Sub-Agent 到 Multi-Agent 的工程指南 — Claude Code 视角的多智能体选型"

## 4. 视觉化 + Frontmatter 质量 [✓]
- Mermaid 用量高（约 10 个图），每个都服务于具体论点：复杂度光谱图、架构拓扑、序列图、决策树、对比图。没有凑数的装饰图。
- 表格使用恰当（Sub-Agent vs Handoff 对比、Handoff vs Router 对比、项目特征表、成本控制表等），信息密度高且易扫读。
- Frontmatter description 包含"四种设计模式""升级决策阶梯""Supervisor 模式""生产环境部署""Claude Code 本地与生产的本质区别""知识库项目选型"等多个关键搜索词，覆盖面好。
- title 与文件名一致。

## 行动建议（按优先级）
1. **Important:** 补充至少一段可运行/伪代码级别的 demo——建议在 §3 "Supervisor + Sub-Agents 模式详解" 后面加一个 Agent SDK 编排示例（即使是伪代码），展示 spawn + await + aggregate 的实际调用形式。当前全文偏"架构讲解"而缺少"动手感"。
2. **Important:** 补齐 3 个文件的反向链接（Skills 渐进式披露架构 / Headless 模式与 Agent SDK / Agent 开发实战），使双向关联完整。
3. **Minor:** §5 的三个生产实例均为假设场景（虽然合理且详细），如后续有真实案例（如本项目的 kb-auditor sub-agent 实际运行数据），可追加一个"实测数据"段落增强说服力。
