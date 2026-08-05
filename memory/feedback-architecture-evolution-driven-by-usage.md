---
name: feedback-architecture-evolution-driven-by-usage
description: 架构演化由使用中产生的问题驱动；脱离当前业务量级的架构设计是 YY，不做预研实现
metadata:
  type: feedback
  lastUpdated: 2026-08-05
---

用户 2026-08-05 确认的架构观：**当前 harness 体系在现有数据量级下已足够健壮，架构演化应由"使用中产生的问题"驱动；脱离业务量级的架构设计是 YY、没有意义。**

**Why**：本轮深度 review 最有价值的发现（镜像漂移、僵尸 subagent 0 次调用、permission-audit 假阳性、`completed (date)` 状态误判）全部是"用出来的问题"，设计时无法预见。体系已过"约束层建设 + 效率优化"两阶段，再堆新机制只会让约束层自身成为维护负担。用户投入 harness 的相当一部分价值是 dogfood 黄佳课程——"学习"本身也是业务，不能按 YAGNI 一刀切。

**How to apply**：
- 少提空想式架构建议；架构级提案必须锚定真实问题或已知规模拐点
- 问题驱动 ≠ 被动等事故：主动体检（如数据驱动分析 logs）仍属问题驱动的延伸，值得做
- "路标式预埋"只设观察点（如 RAG 50/80 篇阈值提醒），不预实现；实现等规模触发
- 用出来的问题优先沉淀为可复用知识（失败模式库），避免同类问题反复排查

关联 [[feedback-proactive-divergent-suggestions]]（发散建议可以有，但架构级建议要锚定真实问题）、[[feedback-no-auto-split]]（拆分也同理：等用户主动）。
