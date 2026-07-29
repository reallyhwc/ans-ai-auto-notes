---
name: project-agents-skills-mirror
description: .claude/skills/ 在这个项目里还有一个 .agents/skills/ 镜像副本（给 Codex CLI 等非 Claude Code 工具用），改 skill 时容易漏改镜像导致两边drift
metadata: 
  node_type: memory
  type: project
  lastUpdated: 2026-07-29
  originSessionId: e6385508-9b6a-4052-8c40-5cd828a4f78e
  modified: 2026-07-29T05:44:16.626Z
---

这个项目除了 `.claude/skills/`（Claude Code 读取），还维护一份 `.agents/skills/` 镜像目录，内容基本对应（用于 Codex CLI 等遵循 `AGENTS.md`/`.agents/` 惯例的工具，跨平台配置的一部分，参见 commit "补充 Codex 跨平台配置"）。

**Why**：2026-07-29 这次改 4 个 `.claude/skills/*/SKILL.md` 文件时完全没注意到 `.agents/skills/` 这个镜像的存在——是在处理一次 git merge 冲突时才偶然发现的（远程有个 commit 单独更新了 `.agents/skills/kb-content-style/SKILL.md`，而我本地只改了 `.claude/skills/kb-content-style/SKILL.md`，两边已经不一致）。CLAUDE.md 里没有提到这个镜像机制，容易被忽略。

**How to apply**：以后编辑 `.claude/skills/*/SKILL.md` 时，先 `ls .agents/skills/` 确认是否有对应镜像文件，如果有，两边都要同步改，或者至少在完成后提醒用户"这次只改了 .claude 那份，.agents 镜像还没同步"。更彻底的做法是提案把这两份改成一个符号链接或者加一个同步脚本（类似 sync-memory.sh 的思路），避免手动维护两份容易漂移——但这属于目录结构变更，需要先跟用户确认再动。
