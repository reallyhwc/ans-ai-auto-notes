---
name: project-quickstart-branch
description: quickStart 分支是 Harness KB 模板（单工具 Claude-Code），2026-08-01 从 main 移植全套 harness 进化，SKIP 双镜像
metadata:
  type: project
  lastUpdated: 2026-08-01
---

**quickStart 分支定位**：ANS AI Auto Notes 的 Harness KB 模板（starter kit），空 kb/ 骨架 + 3 demo 文件 + 完整 harness。新用户 `git clone + bash bootstrap.sh + ./serve.sh` 即可获得 main 的全部 harness 能力，不带个人笔记。

**2026-08-01 移植**：从 main（领先 243 commits）移植全套 harness 进化到 quickStart（63 文件，+3387/-344）。三组并行 subagent 做逐文件 PORT/ADAPT/SKIP 裁定。

**关键决策（SKIP 双镜像）**：quickStart 保持 Claude-Code 单工具模板，**不带** `.codex/` + `.agents/skills/` 双镜像。理由：main 自己都没维护住（`.agents/skills` 4/5 已 drift），引入即把维护债传给模板用户。若未来模板要支持 Codex 用户，再单独立项。

**移植范围**：
- PORT ~32 文件：全套脚本（exit-check 11项/lint/arch-lint 15项/verify-claim/pretool-guard/hook-logger 等）+ settings.json 5 hook + overview 搜索UI + 17 新测试 + 2 新 skill
- ADAPT ~11 文件：CLAUDE.md/README/agents/skills 去 main 个人内容（用户背景/黄佳课程/私人笔记链接/个人 session 事故引用），保留 quickStart 模板占位符+demo
- SKIP ~25 文件：AGENTS.md（个人背景）/ memory-snapshot 11 个人文件 / docs/superpowers plans+specs 12 个 / hook-config-consistency.test（依赖 .codex）
- KEEP ~10 文件：3 demo kb / .gitkeep 骨架 / SETUP.md / memory-snapshot 空模板

**阈值统一**：移植 exit-check.sh → 全局 ≥3/[7/11]（保持 doc-code 一致，不保留 quickStart 旧 ≥5/[7/9]）。

关联 [[project-agents-skills-mirror]]（双镜像纪律，quickStart 不适用）、[[project-knowledge-base]]。
