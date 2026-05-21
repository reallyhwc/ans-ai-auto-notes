---
title: "外部参考链接"
description: "优质外部技术文章、博客、演讲的链接汇总，附带核心要点"
---

# 外部参考链接

> 最后整理: 2026-05-17 | 来源: 日常积累

记录在日常学习和工作中遇到的优质外部文章。每篇文章附核心要点，方便后续回顾时快速判断是否值得重读。

---

## AI Coding & Agent 工程

### 用Agent评测思路管理AI Coding —— 31万行代码AI重构的实践

- **链接**: [知乎](https://zhuanlan.zhihu.com/p/2036090725960504167) | [美团技术博客](https://tech.meituan.com/2026/05/07/agent-ai-coding.html)
- **作者**: 美团技术团队
- **日期**: 2026-05-07
- **核心要点**:
  - **"人人对齐 → 人机对齐"** 方法论：先让团队形成统一工程共识，再固化为 AI Rule/Skill
  - **Pre-PR 机制**：提交前 AI 自查多轮过滤基础问题，人工 CR 只聚焦业务语义
  - **高阶模型审查低阶模型** + 不同厂商模型对抗互相审核
  - **零排期重构**：不申请专项，把技术债拆解为业务需求的"顺带动作"渐进消化
  - AI 帮团队发现 10 个靠人力无法穷举的隐藏性能隐患
  - Human-in-the-loop AI 辅助测试 SOP（5 步法）
- **关联笔记**: [AI Coding 团队治理](../技术/AI/AI-Coding/ai-coding-team-governance.md)

### Claude Code 使用感受如何？——从能用到高效的四阶段工作流

- **链接**: [知乎问答](https://www.zhihu.com/question/1945503640539333416/answer/2028070776788592273)
- **作者**: "先用起来"（产品经理，非程序员背景）
- **日期**: 2026-04-18
- **核心要点**:
  - **四阶段成熟度模型**：裸聊 → 文件化 → 自动化 → 生态化，大多数教程停在阶段 2
  - **"约束 > 文档 > 对话"三层模型**：能机械执行的不靠说（hooks），能写文件的不靠记（plan/manifest/memory），对话层最灵活但最脆弱
  - **SessionStart hooks**：preflight 环境体检 + arch_lint 架构守卫，规则从"建议"变"法律"
  - **Stop hooks**：自动生成 session 摘要，状态从"在脑子里"变"在文件里"
  - **Memory 分层**：稳定层（月级 review）/ 项目层（周级）/ 流水层（日级），不删的 memory 是负债
  - **Plan 文件化 + Manifest 双向依赖声明 + Dev-log 指标驱动反思**
  - 一个人维护 6 个应用 + 4 个基础库 + 2000+ 自动化测试 + 每日自动数据分析日报
- **关联笔记**: [Claude Code 进阶工作流](../技术/AI/Claude-Code/claude-code-advanced-workflow.md)

### 别学歪了：Harness 不是新概念，是你已经在做的事

- **链接**: [知乎](https://zhuanlan.zhihu.com/p/2028105438202184280)
- **作者**: "先用起来"（产品经理，同系列作者）
- **日期**: 2026-04-16
- **核心要点**:
  - **Harness = 套在 LLM 外面的运行时控制系统**，管计划/测试/重试/压缩/分工/审批/持久化
  - **CC 源码六原则自检**：4/6 已有，说明认真配过 CC 的人已经在做 Harness Engineering
  - **机械约束 > 文档约束**："Agent 会复制已有的坏模式"，Linter 比 Prompt 管用
  - **分离评估**：模型不能可靠地评估自己，关键产出用独立 Evaluator Agent
  - **跨 Session 工件化**：Plan 文件加 checkbox + Decision log，文件系统比 memory 可靠
- **关联笔记**: [Harness Engineering](../技术/AI/Claude-Code/harness-engineering.md)

### 不写代码的工程师，才是 AI 时代最值钱的人

- **链接**: [知乎](https://zhuanlan.zhihu.com/p/2012085411615360161)
- **作者**: 汉松（蚂蚁集团技术专家）
- **核心要点**:
  - OpenAI 3 人团队 5 个月产出 100 万行代码，禁止人类写代码
  - **复利工程（Compound Engineering）**：Plan → Work → Review → Compound 五步闭环
  - 工程师角色从"写代码"转向"设计并维护能让 AI 可靠产出代码的工程环境"
- **关联笔记**: [Harness Engineering](../技术/AI/Claude-Code/harness-engineering.md)

---

## 记录格式说明

每条链接记录包含：
- **链接**：原文 URL（可能多个转载源）
- **作者/来源**：谁写的
- **日期**：发布时间
- **核心要点**：3-5 个 bullet points，方便快速回忆
- **关联笔记**：指向本知识库中相关的深度笔记
