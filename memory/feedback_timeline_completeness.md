---
name: Timeline 要记录所有变更，不分大小
description: 每次对话结束时，要把当天做的所有变更（包括知识库内容变更和工程维护操作如 bug 修复、配置变更、settings 更新等）统一追加到当周 timeline，不能只记录"大件事"而漏掉配置变更。
type: feedback
lastUpdated: 2026-05-17---

每次会话结束时，无论变更是知识库内容新增、代码 bug 修复、还是配置文件更新，都要统一追加到当周的 timeline 文件中（`timeline/YYYY-WXX.md`），并附链接指向相关文件。

**Why:** 用户发现之前只记录了知识库大变更，漏掉了 dark mode bug 修复和 settings 白名单更新等工程维护操作，要求"不再只记大件事"。
**How to apply:** 会话结束做退出检查时，回顾 git diff 或 commit 历史，确认所有变更都有对应的 timeline 记录，缺的就补上。
