---
audit_target: kb/技术/AI/应用/Agent Observability：调用链追踪与排障.md
audit_date: 2026-06-03
verdict: minor
---
# Audit: Agent Observability：调用链追踪与排障

## 1. 深度与具象度 [✓]

- §3 给完整 span JSON（含项目真实 id 格式 `r-2026-06-03-02-06-0363`），不是抽象描述；§5.2/§5.3 把 start event + patch event 的 jsonl 原文都贴出来，§5.5/§5.6 还有 `agent-report.js` 与 `agent-tail.js` 真实输出样例——读者能直接对照本项目 `logs/agent-runs/2026-06.jsonl` 验证。
- §4 工具对比表 6 行带"接入方式 + 适合场景 + 缺点"三列，§4.1 进一步给"你的状况 → 推荐方案"决策表，避免了"看起来都对的横向 feature matrix"陷阱。
- §7 五个常见坑每条都附"根治"具体动作（hook try/catch、env 传 parent_id、按 duration 排序），不是空泛建议；§6 升级触发器给出具体阈值（≥100 run/day、≥10 agent 类型、≥5 人）——量化得很好。

## 2. 论述流畅性 + 章节逻辑 [✓]

- 章节顺序：定位 → 痛点（为何需要）→ 数据模型（核心概念）→ 工具横向 → 项目纵向 → 升级路径 → 坑 → 系统关系 → 进阶 → 总结。这是 reference 级笔记的标准骨架，顺承自然。
- §1-§9 + §4.1/§5.1-§5.6/§7.1-§7.5/§9.1-§9.4 编号全部连续无跳号。
- 唯一小重叠：§5（jsonl 落地详解）和 §8（与本项目其他系统的关系）都在描述 hook + agent-log + report 三件套，但 §5 是"数据流时序"、§8 是"组件职责映射表"，侧重不同，没必要合并。
- §9 进阶话题 4 节都是诚实标注"本项目不做"的延伸面，不是凑字数。

## 3. 链接与双向关联语义 [⚠]

- 顶部 4 条"关联"链接（subagents / Agent 四大设计范式 / Hooks / Harness Engineering）语义都正确——这 4 个文件确实是 observability 的相邻概念。
- **双向链接全部未补齐**：4 个目标文件都没回链到本文。特别是 `Harness Engineering：AI Agent 时代的工程范式.md` 第 131 行已明确写"dev-log 体系就是你的 Observability"——这是最强的应回链信号，而本文也在 §8 把"observability 是文档层核心"作为收口论点，双向关联绝对成立。Hooks 文件作为埋点底座、subagents 文件作为被观测对象同理。
- `[[feedback-agent-log-patch]]` 用了 3 处 wiki 风格双方括号语法，但本项目其他 kb 文件都用标准 markdown `[label](path)` 或 `> 关联:` 段——build-index 与 overview.html 渲染器都不会把 `[[xxx]]` 解析成超链接，会以裸文本显示，等于死链。memory/ 在 kb/ 之外，建议改为引用文字"feedback-agent-log-patch（见 memory/）"或干脆指向 MEMORY.md 索引锚点。

## 4. 视觉化 + Frontmatter 质量 [✓]

- 2 个 Mermaid 图都是核心概念的可视化（§3 trace 树展示 parent_id 拼树、§5.1 数据流 LR 图），不是装饰；尤其 §3 的 6 节点 tree 直接对应本项目真实 agent 拓扑（main → kb-auditor / plan-executor → implementer / spec-reviewer → fix-on-fail），加分。
- 6 个表格分工清晰，没有重复结构。§5.4 outcome 三态 + VERDICT 信号映射特别有用——直接让主 agent patch 时知道选哪个值。
- Frontmatter title 与文件名一致；description 142 字覆盖"定位 + span 数据模型 + 工具对比 + 项目落地 + 升级路径"，搜索时多关键词都能命中。

## 行动建议（按优先级）

1. **Important:** 把 3 处 `[[feedback-agent-log-patch]]` 改为标准 markdown 链接或纯文本引用（`memory/feedback-agent-log-patch.md`）。当前语法在本项目渲染器下是死链。
2. **Important:** 在 4 个上游文件（Harness Engineering、subagents、Hooks、Agent 四大设计范式）的"关联"段补回链到本文。Harness Engineering §131 的"dev-log 体系就是 Observability"是最强应回链点。
3. **Minor:** §5 与 §8 内容轻微重叠——若担心冗余可在 §8 表格上方加一句"本节是 §5 数据流的组件视角索引，不重复展开"，引导读者。
4. **Minor:** §9.2 token 成本分析提到"prompt_tokens / completion_tokens / cached_tokens"——若本项目近期会扩展 jsonl schema 加这几个字段，可在 §5.2 数据流处留个 TODO 锚点便于后续追加。
