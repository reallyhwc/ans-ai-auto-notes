---
name: kb-tdd-discipline
description: Use when modifying scripts/ or tests/, or fixing bugs in markdown rendering, path resolution, frontmatter parsing, or lint scripts.
---

# KB TDD Discipline (ANS AI Auto Notes 项目)

## 触发条件

**MUST invoke when**:
- 修改 `scripts/*.{sh,js}` 文件
- 修改 `tests/*.test.js` 文件
- 修复 markdown 渲染、路径解析、frontmatter、静态校验脚本（错误趋向区域）

## 软 TDD 流程

1. 错误趋向区域**先红后绿**：先写失败测试（红）→ 最小实现（绿）→ 重构 → commit
2. Bug 修复**先复现再修**：先加复现 test → 确认 fail → 修 code 转绿 → commit（`fix:`）

## 豁免（不强制 TDD）

纯文本（kb/*.md、AGENTS.md、README）、CSS（overview.html）、配置（settings.local.json / .gitignore）。

## 测试入口与组织

- 入口：`bash test.sh`；单文件 `node --test tests/xxx.test.js`
- `tests/` 下按被测对象命名 `<source>.test.js`（当前 36 个）。核心分层：数据构建（lib/build-index/build-timeline）、链接契约（link-renderer/anchor-check/backlinks）、hook 体系（agent-log/hook-logger/verify-claim/session-log）、质量结构（arch-lint/lint/content-quality/check-overview/integration）、规则一致性（auto-commit-skill/auto-save-discipline/rule-consistency/skill-mirror）。

## Push 前自动跑测试（双层 gate）

`scripts/git-hooks/pre-push` 硬拦截 + `exit-check.sh` auto-push 时先跑 test。首次安装：`bash scripts/install-hooks.sh`。

## Rationalization Table（借口 vs 现实）

| 借口 | 现实 |
|---|---|
| "改了脚本没加测试" | 先加 failing test 再改 code——没测试就是没验证 |
| "测试随便写一行" | 要真验证行为，不只是 assert.ok(true) |
| "跳过 pre-push 因为肯定能过" | 不允许 --no-verify；"肯定能过"正是没跑过才会说 |

## 自检 Checklist

- [ ] 改 scripts/ 有对应 test？修 bug 先加复现 test？
- [ ] 走完整红→绿→重构？push 前 `bash test.sh` 全绿？
