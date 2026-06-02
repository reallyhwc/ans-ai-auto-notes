---
name: feedback-self-review-before-next-task
description: "多步任务完成后、做下一个大改动前，主动 self-review 本次改动（不等用户提示）；用户明确要求\"做改动前先 review 下\""
metadata: 
  node_type: memory
  type: feedback
  lastUpdated: 2026-05-18
  originSessionId: 5dee47af-aa5a-4c55-ac2d-382ce77a3b18
---

**规则：完成一个大批次任务后，下一个大动作之前，主动对刚完成的工作做一次 self-review，识别过度设计 / 回归 bug / 与项目精神冲突的地方。不等用户问。**

**Why:**
- 2026-05-18 我连续做完 7 个 Phase（深度审计 + 全面优化），自我评估"全部完成"。用户接着说"在做改动前，先 review 下你本次的改动有没有问题"
- review 后立刻发现 4 个真实问题：
  1. 加了 package.json 过度工程化（违反零依赖原则）
  2. README 砍多了（把"门面信息"和"AI 参考信息"混淆，砍掉了对人类访客有价值的内容）
  3. 引入了一个回归 bug（Phase 2 加 set -uo pipefail 没防御 session-log.sh 的 `$1` unbound）
  4. 目录深度规则改成了"裁量条款"，未来容易漂移
- 这些都是 self-review 能在 5 分钟内发现的问题。不做 self-review 就直接进入下一个任务，问题会累积

**How to apply:**
- 完成一批改动后，先回头扫一遍：
  - 哪些改动引入了新的依赖/复杂度？真的必要吗？
  - 哪些改动跟项目已建立的精神（CLAUDE.md、过往 review）冲突？
  - 哪些"顺手优化"其实超出了用户原始请求？
  - 有没有引入回归 bug（验证已有测试 + 跑现有 lint）？
- 把发现按"严重 / 中等 / 轻微"分级，跟用户对齐再修
- **特别关注**：刚加的工具链、新规则、连锁链接更新——这些最容易引入回归
