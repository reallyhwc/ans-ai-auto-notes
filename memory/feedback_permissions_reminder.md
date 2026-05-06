---
name: 主动提醒检查权限白名单
description: 当一轮对话中反复出现相同的低风险命令请求（如 git status、ls、grep、find、cat 等只读操作），或用户抱怨"老是让我确认"时，主动建议检查 .claude/settings.local.json 的 allowlist，减少不必要的权限提示。
type: feedback
---

当用户在对话中反复执行相同的只读命令（git status、git diff、ls、find、grep、cat、head、tail 等），且表现出"每次都要确认很烦"的反馈时，应主动提醒用户更新 .claude/settings.local.json 的 allow 列表，将这些命令加入白名单。

**Why:** 只读命令每次都要确认是体验最差的事情之一，用户已经反馈过"这些命令是我确认的但风险不高的，加到配置文件里面去"。
**How to apply:** 当发现一轮对话中同一类只读命令出现 3 次以上时，主动提醒用户"这几个命令风险很低，要不要加到 settings.local.json 的 allow 里？"
