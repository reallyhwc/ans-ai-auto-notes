---
name: Cross-Environment Workflow
description: 用户在公司和家之间切换，用不同工具维护同一知识库
type: project
lastUpdated: 2026-09-11
---

用户在多台机器 / 多个 Harness 上维护知识库：
- **公司电脑**：Mac，使用 Aone Copilot IDE 插件 + Claude Opus
- **个人电脑**：Mac，使用 Claude Code CLI
- **个人电脑（2026-09-11 起）**：DeepSeek Harness（DSH）Web GUI，工具 schema 与 Claude Code 高度相似（同样有 sandbox / approval / subagent / hooks），但**技能目录是 `.agents/skills`**（Claude Code 侧是 `.claude/skills`，两者是双镜像，改一边要同步另一边）

三者通过 git push/pull 同步。每次新会话启动时，必须 `git log --since` 检查近期提交，了解其他环境下做了什么改动，确保 memory 和规则理解跟上最新状态。

**DSH 会话的操作差异（踩过）**：
- `node` 不在 DSH 会话的 PATH 里（PATH 为 `/Applications/Raven DSH.app/.../node_modules/.bin:/usr/bin:/bin:/usr/sbin:/sbin`），跑项目脚本前需 `export PATH="/opt/homebrew/bin:$PATH"`，否则 `node scripts/build-index.js` / `bash test.sh` 直接 `command not found`
- DSH 的文件沙箱默认 `workspace-write`：只能写会话工作区 + 平台临时目录；写 `~/.mws`、`~/.claude` 等外部路径会被拒（`[sandbox: file access denied under workspace-write mode]`），需显式申请一次升权

**Why:** 多个环境的会话历史不互通，git commits 是唯一的交接机制。错过近期的重构/规则变更会导致操作错误。

**How to apply:** 每次会话开始后第一步就是读 git log 近一周提交 + 读 CLAUDE.md/AGENTS.md + INDEX.md，不要假设上次本地对话的状态就是最新状态。
