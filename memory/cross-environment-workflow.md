---
name: Cross-Environment Workflow
description: 用户在公司和家之间切换，用不同工具维护同一知识库
type: project
lastUpdated: 2026-05-17
---

用户在两台机器上维护知识库：
- **公司电脑**：Mac，使用 Aone Copilot IDE 插件 + Claude Opus
- **个人电脑**：Mac，使用 Claude Code CLI

两者通过 git push/pull 同步。每次新会话启动时，必须 `git log --since` 检查近期提交，了解另一个环境下做了什么改动，确保 memory 和规则理解跟上最新状态。

**Why:** 两个环境的会话历史不互通，git commits 是唯一的交接机制。错过近期的重构/规则变更会导致操作错误。

**How to apply:** 每次会话开始后第一步就是读 git log 近一周提交 + 读 CLAUDE.md + INDEX.md，不要假设上次本地对话的状态就是最新状态。
