---
name: auto-commit-discipline
description: Use when finishing any batch of file changes in this KB project (one logical topic complete). Also use before sending response to user when there are uncommitted changes. Quick reference for commit discipline — full rules in CLAUDE.md.
---

# Auto-Commit Discipline (Quick Reference)

> **完整规则见 CLAUDE.md「Git 规则」章节**，本 Skill 仅提供快速参考和独有内容。

## 触发条件

**MUST invoke when**:
1. 完成一个逻辑主题的批量文件变更（如：一篇笔记沉淀、一个脚本写完、一组测试通过）
2. 即将向用户发送响应但 `git status` 非 clean
3. Stop hook 前（与 exit-check.sh 联动）

## 快速参考（详见 CLAUDE.md）

- **Commit 格式**：Conventional Commits（`feat:` / `fix:` / `docs:` / `chore:` / `refactor:`）
- **提交时机**：每个逻辑主题完成立即 commit，不等用户提醒
- **自动 push 阈值**：≥3 commits 未 push → exit-check.sh 自动跑 test 后 push（含 pull --rebase 重试）
- **永不违反**：永不 amend 已 push 的 commit、永不 --no-verify、永不 `git add -A` 全量加

## HEREDOC Commit 示例（Skill 独有）

```bash
git commit -m "$(cat <<'EOF'
feat: xxx

详细说明...

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

## 自检 Checklist（提交前）

- [ ] `git diff --cached` 已 review
- [ ] commit message 符合 Conventional Commits
- [ ] 未包含敏感文件（.env / credentials / *.key）
- [ ] 未跳过 hooks
- [ ] 未 amend 已 push 的 commit

## 反面案例

- ❌ "我打包完成多件事后一起 commit" → 应该每个逻辑主题完成立即 commit
- ❌ "用户没催 commit，我先继续干别的" → 主动性在 AI 这边
- ❌ `git commit --amend` 修改已 push 的 commit → 永不
- ❌ `git add -A` 全量加 → 明确 `git add <具体文件>` 避免误提交

## 与其他 hook 的关系

- `exit-check.sh [7/11]` 检查未 push commit 数量，≥3 自动 push（含 pull --rebase 重试）
- `pre-push hook` 跑 test + mermaid 守恒检查兜底
- `verify-claim.sh` (PostToolUse hook) 验证 kb/ 文件写入

详见 [CLAUDE.md「Git 规则」章节](../../../CLAUDE.md)。
