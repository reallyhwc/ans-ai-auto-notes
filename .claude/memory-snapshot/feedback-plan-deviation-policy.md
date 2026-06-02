---
name: feedback-plan-deviation-policy
description: 执行 plan 时遇内部矛盾（state 假设不成立 / example 不一致 / 依赖未满足）不要自己拍板偏离，先 STOP 报告 NEEDS_CONTEXT 让用户决定
metadata: 
  node_type: memory
  type: feedback
  lastUpdated: 2026-06-02
  originSessionId: a967c2f2-c66f-40b6-a7ce-4e311cd35d00
---

执行 `executing-plans` skill 跑 plan 时，如果发现 plan 内部矛盾——例如：

- plan 步骤假设某个 state 已存在但实际不在（如 G4 假设 G2 已合入 [N/8]，但 main 上还是 [N/7]）
- plan 代码 example 与对应测试 example 不一致
- plan 引用的某个文件/依赖在当前 worktree base 下不存在

**默认动作**：STOP 报告 `NEEDS_CONTEXT`，让用户决定是改 plan 还是改 state，**不要**自己挑一个方向硬干。

**Why**：用户明确说过 "不要自己拍板偏离 plan，先 STOP 报告"。原因是 plan 是用户的契约，AI 自作主张可能引发非预期重构，回滚成本高。

**How to apply**：

- 大方向矛盾（plan 流程与实际 state 完全对不上）→ 必停。
- 小型 local-numbering 假设（如 "G2 worktree 假设 G1 不存在用 [14/14]"）→ 已在 plan 中**示范过的模式**可沿用，但要在 commit message 说明、并在 `docs/superpowers/integration-notes/` 留集成期 TODO。
- 不确定边界时偏向"停下问"。

**关联**：[[feedback-self-review-before-next-task]] 是相关的「主动暂停」类反馈。
