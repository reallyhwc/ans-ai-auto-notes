# Architecture Decision Records (ADR)

> 项目内重大架构决策、分类争议的归档。新决策追加 ADR，编号单调递增。
> 用途：让 AI 在分类摇摆或架构选择时有先例可循，避免目录漂移。

---

## ADR-001: AI 子树拆 5 个子目录（基础/大模型/Claude-Code/AI-Coding/应用）

- **日期**: 2026-05 起
- **状态**: 接受
- **背景**: kb/技术/AI/ 内容快速膨胀，单层 AI 目录文件数 >15，混合多个子领域
- **选项**:
  - (a) 保持单层（按 frontmatter tag 分组）
  - (b) 拆 2 个子目录（基础 / 应用）
  - (c) 拆 5 个并列子目录（基础/大模型/Claude-Code/AI-Coding/应用）
- **决定**: (c)
- **理由**:
  - 5 个子领域边界清晰，每个 ≥3 文件
  - 物理目录拆分（user feedback: physical-structure-over-metadata）
  - manifest + INDEX 由 build-index 自动生成，目录就是分类

## ADR-002: timeline.json 改为构建产物（仅自动化 JSON，md 保留手维护）

- **日期**: 2026-06-01
- **状态**: 接受
- **背景**: timeline.json 手维护是负担，但 timeline/*.md 含人类叙事性内容
- **选项**:
  - (a) 两者都自动化
  - (b) 仅自动化 timeline.json，timeline/*.md 保留
  - (c) 反过来，timeline/*.md 才是源，JSON 从 md 生成
- **决定**: (b)
- **理由**:
  - JSON 可机器生成（git log + frontmatter 已含所需信息）
  - md 的"为什么改 / 感悟"是人类才能写的
  - 渐进式自动化优于一次性大改

---

## 新 ADR 模板

```markdown
## ADR-NNN: <短标题>

- **日期**: YYYY-MM-DD
- **状态**: 接受 / 已替换（被 ADR-XXX 替代） / 已弃用
- **背景**: <为什么需要决策>
- **选项**:
  - (a) ...
  - (b) ...
- **决定**: <选了哪个>
- **理由**: <为什么>
```
