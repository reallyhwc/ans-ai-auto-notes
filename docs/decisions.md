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

## ADR-003: KB 系统升级 13 项（数据/Hook/规则/同步/编辑器）—— 整体规划 + 5 worktree 并行

- **日期**: 2026-06-01 ~ 2026-06-02
- **状态**: 接受
- **背景**: 2026-06-01 audit 暴露多个结构性问题：AI 漏 CLAUDE.md 规则、session-log 利用率近零（30 天 176 commits / 3 个日志）、timeline.json 手维护、跨设备 onboarding 缺失、anchor 链接无存活检查、内容质量风格只靠 AI 自律
- **选项**:
  - (a) 修补单点（每次发现一个问题改一个）
  - (b) 整体规划 13 项分 5 组（G1 数据/G2 Hook/G3 Skills/G4 Sync/G5 Tools）并行实施
- **决定**: (b)
- **理由**:
  - 单点修补会让规则碎片化、CLAUDE.md 继续膨胀
  - 5 组边界清晰且独立，可并行 worktree（独立 session 同时开 4 个）
  - 集成顺序 G1→G5 利用依赖关系（如 G1.0 lib.js 重构是 G1 Task 5 的前置）
  - dogfood B5 ADR（本条 ADR 自己就是 G5 工具的首次实战使用）
- **执行回顾**:
  - G1 主 session 跑通验证 plan 质量（subagent-driven，5 task + 1 follow-up，70 → 70+5 tests）
  - G2-G5 用户开 4 个独立 terminal 并行（hybrid 方案）
  - 每组完成后做 self-audit，集成期 todo 沉淀到 `docs/superpowers/{integration-notes,plans}/`
  - 串行集成发现的连锁问题：arch-lint 编号 [13/15]、exit-check 编号 [7/9]、.gitignore negation 重叠、PostToolUse hook 跨机器同步、verify-claim 孤儿误报
- **关联**:
  - [spec](superpowers/specs/2026-06-01-kb-system-uplift-design.md)
  - [plan](superpowers/plans/2026-06-01-kb-system-uplift-plan.md)
  - [G2 集成 handoff](superpowers/plans/2026-06-02-g2-integration-handoff.md)
  - [G4 集成 notes](superpowers/integration-notes/g4.md)
  - [G5 audit findings](superpowers/plans/2026-06-01-kb-uplift-g5-audit-findings.md)
- **指标**: 105 tests pass (49 baseline → 105, +56 新增), arch-lint 0 errors / 7 warnings (3 pre-existing 行数 + 3 真实 anchor bug + 1 内容质量), 集成 30+ commits

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
