# kb-auditor 审计报告

> kb-auditor subagent 跑完后把详细 report 写入此目录。设计文档：[3 subagent spec](../../docs/superpowers/specs/2026-06-03-three-subagents-design.md#2-kb-auditor)

## 文件命名

`<basename>-<YYYY-MM-DD>.md` — basename 是被审计 kb 文件的 basename（无路径、无 .md 后缀）。

例：审计 `kb/技术/AI/大模型/Transformer.md` 在 2026-06-03 产出
→ `logs/audits/Transformer-2026-06-03.md`

## Schema

每个 report 是 markdown 文件，frontmatter：

```yaml
---
audit_target: kb/技术/AI/大模型/Transformer.md
audit_date: 2026-06-03
verdict: pass | minor | major
---
```

Body 含 4 章节（深度 / 流畅性 / 链接 / 视觉化）+ 行动建议。详见 spec §2.2。

## 为什么不放 kb/

避免污染 `build-index.js` 扫描的 manifest + 不干扰 SPA 导航。
