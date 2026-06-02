---
name: feedback-claude-ignore-pattern
description: ".gitignore 父目录被 ignore 后，子目录无法用 `!` negation 重新 include；要例外某个 .claude/ 子目录必须改用 `.claude/*` + `!.claude/<subdir>/`"
metadata: 
  node_type: memory
  type: feedback
  lastUpdated: 2026-06-02
  originSessionId: a967c2f2-c66f-40b6-a7ce-4e311cd35d00
---

git 文档明确：**A parent directory of an excluded file cannot be re-included.** 也就是说如果 `.gitignore` 有 `.claude/` 这种"整个目录 ignore"的规则，再加 `!.claude/memory-snapshot/` 是**无效**的——git 根本不会下钻到被 ignore 的目录里看 negation。

**正确写法**：父目录用 `.claude/*`（match 内容而非目录本身），然后再用 `!.claude/<subdir>/` 把要 include 的子目录捞回来：

```gitignore
.claude/*
!.claude/memory-snapshot/      # A6 跨设备 memory snapshot
!.claude/skills/               # G3 项目级 skill 规则
```

**How to apply**：每次往 `.claude/`（或任何被全量 ignore 的父目录）下新增"需要入 git 的子目录"时，按这个模式补例外。改完用 `git check-ignore -v <file>` 验证。

**Why**：G4 实施 A6（memory snapshot 入 git）时第一次踩坑——原规则是 `.claude/`，加了 `!.claude/memory-snapshot/` 无效，文件仍 ignored；改成 `.claude/*` 才生效。后续 G3 加 `.claude/skills/` 也会踩同样坑，G4 已预留例外。

**关联**：[[feedback-worktree-index-drift]] 是同期 G4 实施总结。
