# Memory 索引

> 最后更新: 2026-07-29

## Feedback
- [目录结构偏好](目录结构偏好.md) — AI 子树 5 个并列子目录（基础/大模型/Claude-Code/AI-Coding/应用），manifest+INDEX 由 build-index 自动生成不要手改
- [绘图表达偏好](绘图表达偏好.md) — 笔记中需要画图时优先使用 Mermaid（```mermaid），而非 ASCII 框图，overview.html 会渲染为可视化图形
- [feedback-zero-npm-deps](feedback-zero-npm-deps.md) — 项目坚持零 npm 依赖；优先 Node 内置/vendoring/vanilla，引入 package.json 须用户确认
- [feedback-self-review-before-next-task](feedback-self-review-before-next-task.md) — 多步任务完成后下个大动作前主动 self-review，不等用户提示
- [feedback-physical-structure-over-metadata](feedback-physical-structure-over-metadata.md) — 分类决策默认选物理目录拆分，不要用 frontmatter 字段/脚本逻辑做隐式分组
- [feedback-worktree-index-drift](feedback-worktree-index-drift.md) — worktree 内 build-index 跑出的 INDEX.md 是 worktree base 版本，commit 前 `git checkout -- INDEX.md` discard
- [feedback-plan-deviation-policy](feedback-plan-deviation-policy.md) — 执行 plan 遇内部矛盾不要自己拍板，先 STOP 报告 NEEDS_CONTEXT，例外是 plan 已示范过的 local-numbering 模式
- [feedback-claude-ignore-pattern](feedback-claude-ignore-pattern.md) — .gitignore 父目录被 ignore 后子目录无法 negation，必须 `.claude/*` + `!.claude/<subdir>/`
- [feedback-trust-priority-then-execute](feedback-trust-priority-then-execute.md) — 给带优先级/成本的问题表格后用户倾向直接授权批量执行，但要求过程完后如实汇报效果（含未达成部分）

## Project
- [project-macos-shell-constraints](project-macos-shell-constraints.md) — 本机 bash 3.2 无关联数组、无 GNU timeout、BSD realpath 无 -m、APFS 大小写不敏感，写 shell 脚本前要假设这些限制
- [project-agents-skills-mirror](project-agents-skills-mirror.md) — .claude/skills/ 在 .agents/skills/ 还有一份镜像（Codex CLI 用），改 skill 时两边都要同步，否则会漂移
