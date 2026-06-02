---
name: auto-commit-discipline
description: Use when finishing any batch of file changes in this KB project (one logical topic complete). Also use before sending response to user when there are uncommitted changes. Enforces conventional commits in 中/英, never amend, ≥5 unpushed triggers auto-push, never skip hooks.
---

# Auto-Commit Discipline (ANS AI Auto Notes 项目)

## 触发条件

**MUST invoke when**:
1. 完成一个逻辑主题的批量文件变更（如：一篇笔记沉淀、一个脚本写完、一组测试通过）
2. 即将向用户发送响应但 `git status` 非 clean
3. Stop hook 前（与 exit-check.sh 联动）

## 规则

### Conventional Commits 格式
- `feat: xxx` — 新功能
- `fix: xxx` — 修复 bug
- `chore: xxx` — 维护性工作
- `docs: xxx` — 文档/知识内容变更
- `refactor: xxx` — 重构（不改变行为）

消息用中文或英文均可，简明描述"做了什么、为什么"。

### 提交动作纪律
- **永不 amend**：CLAUDE.md 已经 push 过的 commit 不能 amend
- **永不 --no-verify**：不跳过 pre-commit / pre-push hooks
- **永不 git add -A 全量加**：明确 `git add <具体文件>` 避免误提交敏感文件
- **HEREDOC commit 多行 message**：

```bash
git commit -m "$(cat <<'EOF'
feat: xxx

详细说明...
EOF
)"
```

### 自动 push 阈值
- 未 push commit ≥5 → exit-check.sh 自动跑 test 通过后 push
- 未 push commit <5 → 仅提示，不自动 push
- pre-push hook 兜底：`test.sh` 通过 + mermaid 守恒检查通过

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

## 与其他 skill / hook 的关系

- `exit-check.sh [7/9]` 检查未 push commit 数量，≥5 自动 push
- `pre-push hook` 跑 test 兜底
- `verify-claim.sh` (PostToolUse hook) 验证 kb/ 文件写入

详见 [CLAUDE.md 索引段](../../../CLAUDE.md)。
