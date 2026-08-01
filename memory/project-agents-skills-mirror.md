---
name: project-agents-skills-mirror
description: .claude/skills 与 .agents/skills 是双镜像，改 skill 必须两边同步，否则 Codex 侧漂移
metadata:
  type: project
  lastUpdated: 2026-08-01
---

项目有**两套 skill 镜像**，必须保持内容一致（仅文档引用名不同）：

| 镜像位置 | 用途 | 引用的主文档 |
|---|---|---|
| `.claude/skills/` | Claude Code CLI（source of truth） | `CLAUDE.md` |
| `.agents/skills/` | Codex CLI | `AGENTS.md` |

另有 `.Codex/agents/*.toml`（Codex 的 subagent 定义），body 应与 `.claude/agents/*.md` 逐字一致（仅缺 tools 字段，靠 prompt 兜底 review-only）。

**规则**：改任何 skill 内容（阈值、description、标题、规则）时，必须两边同步改。`.claude/` 是 source of truth，`.agents/` 跟随——但 `.agents/` 版里的 `CLAUDE.md` 引用要替换成 `AGENTS.md`。

**Why**：2026-06-16 把 auto-push 阈值从 ≥5 降到 ≥3 时，只更新了 `.claude/` + CLAUDE.md + exit-check.sh，Codex 侧的 `.agents/skills/` + AGENTS.md 漏改，导致 Codex CLI 用户看到的阈值与实际 hook 行为不符。同理 description 加 workflow 总结、"反面案例"标题非规范名等问题都因无人记得检查镜像。

**How to apply**：
1. 改 `.claude/skills/X/SKILL.md` 后，立即同步到 `.agents/skills/X/SKILL.md`
2. 同步时把正文里的 `CLAUDE.md` 替换成 `AGENTS.md`（description 里也改）
3. 若 `.claude/skills/` 新增了 skill 目录，`.agents/skills/` 要对应补齐
4. 定期 `diff -r .claude/skills/ .agents/skills/` 检查漂移（仅文档名差异是合法的）
5. 阈值/项数等数字型配置，三处必须一致：`.claude/skills/` + `.agents/skills/` + 实际 hook 脚本（exit-check.sh 等）

关联 [[feedback-agent-log-patch]]、[[project-knowledge-base]]。
