---
name: feedback-exit-checklist
description: 用户说退出时，先执行5项检查（格式/链接/Memory/Git/索引）再结束
type: feedback
originSessionId: ff641dae-a73b-4600-9f28-4c7bd678dcac
---
**规则**：当用户说"准备退出"、"不聊了"、"下次再继续"等结束语时，不能直接结束。必须先执行 5 项检查：文件格式、交叉链接、Memory 持久化、Git 提交、INDEX.md 日期。

**Why:** 用户希望确保下次进入会话时一切照旧，不会因为遗漏持久化导致上下文丢失或格式不一致。本次会话中用户明确要求将此行为记录为规则。

**How to apply:** 听到退出信号 → 执行 CLI 已写入的 5 项检查 → 全部通过后报告 → 结束。如果检查发现问题，先修复再报告。
