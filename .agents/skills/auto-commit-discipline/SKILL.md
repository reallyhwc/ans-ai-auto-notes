---
name: auto-commit-discipline
description: Use when finishing any batch of file changes in this KB project (one logical topic complete). Also use before sending response to user when there are uncommitted changes.
---

# Auto-Commit Discipline (Quick Reference)

> **完整规则见 AGENTS.md「Git 规则」章节**，本 Skill 仅提供快速参考和独有内容。

## 触发条件

**MUST invoke when**:
1. 完成一个逻辑主题的批量文件变更（沉淀/脚本/测试）
2. 响应前 `git status` 非 clean

## 核心规则

- **时机**：每个逻辑主题完成立即 commit，不等提醒
- **格式**：Conventional Commits（`feat:` / `fix:` / `docs:` / `chore:` / `refactor:`）
- **消息**：多行用 HEREDOC，末尾带 `Co-Authored-By: Claude`
- **push 阈值**：≥3 commits 未 push → Stop hook 自动跑 test 后 push
- **永不**：amend 已 push 的 commit、`--no-verify`、`git add -A` 全量加

## HEREDOC Commit 示例

```bash
git commit -m "$(cat <<'EOF'
feat: xxx

详细说明...

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

## 自检 Checklist

- [ ] `git diff --cached` 已 review
- [ ] 未含敏感文件（.env / credentials / *.key）
- [ ] 未跳 hooks / 未 amend 已 push

## Rationalization Table

| 借口 | 现实 |
|---|---|
| "多件事一起 commit" | 每个逻辑主题完成立即 commit，不攒批 |
| "用户没催，先干别的" | 主动性在 AI，不等提醒 |
| `git commit --amend` 改已 push commit | 永不——破坏远端历史 |
| `git add -A` 全量加 | 明确 `git add <具体文件>`，避免误提交敏感文件 |
