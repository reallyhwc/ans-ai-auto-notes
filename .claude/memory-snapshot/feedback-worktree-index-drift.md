---
name: feedback-worktree-index-drift
description: 在 worktree 内 commit 时，build-index 跑出的 INDEX.md 经常是 worktree base（origin/main）版本，与最新 main 有版本差，commit 前需 discard
metadata: 
  node_type: memory
  type: feedback
  lastUpdated: 2026-06-02
  originSessionId: a967c2f2-c66f-40b6-a7ce-4e311cd35d00
---

在 worktree 内执行 `node scripts/build-index.js` 后，`INDEX.md` 会被改写成 worktree base（origin/main 创建 worktree 那一刻的状态），而**不是**最新的 main 版本。典型表现：`Transformer.md` 大小写差异（origin/main 还是小写 `transformer.md`，最新 main 已 rename）。

**How to apply**：在 worktree 内 commit 前，如果 `git status` 显示 ` M INDEX.md` 但 diff 只是大小写/小幅文件名漂移，直接 `git checkout -- INDEX.md` discard 即可，不要把这个 INDEX.md 带进 commit。

**Why**：worktree 通过 `EnterWorktree` 创建时基于 `origin/<default>`（fresh 策略），但 main 可能在创建后又有过 rename/case-change commits。集成阶段 rebase 会用最新 main 的 INDEX.md 覆盖。

**关联**：[[feedback-claude-ignore-pattern]] 也是 G4 实施中踩坑后总结的 worktree 工作流注意点。
