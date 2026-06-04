---
name: kb-content-style
description: Use when writing or editing any markdown file under kb/ in this ANS AI Auto Notes project. Enforces Mermaid-first visuals, demo retention over abstraction, file splitting when >1000 lines, continuous chapter numbering, and Chinese filename = frontmatter title rule.
---

# KB Content Style (ANS AI Auto Notes 项目)

## 触发条件

**MUST invoke when**:
- 写入 / 编辑 `kb/` 目录下任何 .md 文件
- 准备拆分 kb/ 文件时
- 给一个新的 kb/ 笔记起文件名时

## 笔记风格规则

### 1. 保留 demo 和示例
笔记不是抽象提炼，而是要保留对话中给出的具体例子、图解、类比说明。**用户喜欢带 demo 的 QA 风格，反对干瘪的总结**。

### 2. Mermaid 优先
需要画图时优先使用 ` ```mermaid ` 块（overview.html 会渲染为可视化 SVG）：
- 流程图 → `flowchart TD/LR`
- 时序图 → `sequenceDiagram`
- 架构图 → `flowchart TB` + `subgraph`

ASCII 框图仅在 Mermaid 不适用时使用。范例参考 `kb/技术/AI/Claude-Code/claude-code-architecture.md` 内的 8 处 mermaid 用法。

### 3. 重组而非堆砌
同一主题的多次对话要持续归纳合并为自上而下的结构化文档，不应出现多个同日期独立小节堆在一起。

### 4. 反面例子
"卷积操作是通过滤波器在输入矩阵上进行滑动窗口运算提取特征" —— 这种纯定义就是太抽象。

### 5. 判断标准
读起来像教科书定义 = 太抽象。读起来像有人拿草稿纸演示 = 对的。

## 文件组织规则

### 同主题聚合
同主题持续追加到同一文件，不按日期拆分。文件内**最新内容追加在顶部**，以 `## YYYY-MM-DD - 标题` 为二级标题。

### 中文文件名（强制）
磁盘文件名必须与 frontmatter `title` 一致：
- 冒号 `:` → 全角 `：`
- 移除 `/ \ * ? " < > |` 非法字符
- 多空格合并为一个
- 过长（>60 字）截断

新文件创建时直接用中文名；旧文件重命名用 `node scripts/rename-mapping.js --apply`。

### 目录深度
默认两层（`技术/Java/jvm-gc.md`）。允许第三层的条件：每个子目录 ≥3 篇文件 + 子领域边界清晰。

## 文件拆分规则

满足以下**任意两条**时主动提案拆分：

| 维度 | 阈值 |
|---|---|
| 行数 | >1000 关注，>1500 必须拆 |
| 章节数 | >7-8 个 `##` |
| 主题凝聚度 | 覆盖 3+ 个可独立成文的方向 |

**判断方法**：读完文件后问自己——"如果一个新人只想了解 X，他需要通读整个文件吗？"如果答案是"是"但 X 只是文件中的一小部分，就应该拆分。

**拆分后**：原文件保留核心 + 指向子文件链接；章节编号重新从 1 整理（无跳号）；更新 INDEX.md 和 overview.html。

## 章节编号 + 标题 ID

- 使用 `## N.` 样式时，h2 编号必须从 1（或 0）连续递增 —— 由 `arch-lint.sh` 章节编号连续性检查自动兜底
- 内联代码不影响 slugify：`buildToc` 在 slugify 前必须 `stripInline` —— 由 `arch-lint.sh` 标题 ID 契约检查 + `tests/lib.test.js` 双保险
- 修改 lib.js slugify 或 heading renderer 时，必须同步更新 lib.js + app.js

## 跨文件关联

涉及多维度的知识点（如《我看见的世界》提到 RNN）：
- 读书笔记侧重阅读上下文 + 感悟
- 技术文件侧重纯技术干货
- **两处不是复制**，互留链接 `相关: ../技术/ai/rnn.md`

## 自动沉淀，不询问（强制性）

对话中产生的技术讲解、概念梳理、方案对比等知识内容，**直接写入 kb/ 对应文件，同一条消息中完成**。

**绝对不要做**：
- ❌ "需要我把这个沉淀到知识库吗？"
- ❌ "要不要我记录一下？"
- ❌ 解释完技术内容后，结尾问一句"要沉淀吗？"

**正确做法**：解释 + 写入一条龙，用户看到回复时文件已经在磁盘上了。

**反面例子**：上一轮对话中 AI 详细介绍完 Go 和 TypeScript 后，结尾问"需要我把 Go 和 TypeScript 的对比沉淀到知识库吗？"——这就是典型的违规。正确做法是解释完直接写文件，不等用户确认。

> 此规则的唯一例外：涉及文件拆分、合并、重组、目录结构变更时需要提案。但"提案"不等于"问要不要沉淀"——提案是给出具体方案让用户选，不是问"要不要做"。

## 严禁口头沉淀

结束响应前，如果声称"已沉淀到 xxx.md"，**必须先用 Read 工具确认文件确实存在于磁盘**。宁可不说"已沉淀"，也不允许文件不存在却说已沉淀。

## 自检 Checklist

- [ ] **有没有问"要不要沉淀？"—— 问了就是违规，应该直接写**
- [ ] 新增内容是否含 mermaid / 代码块 / 表格 任一
- [ ] 是否过度抽象（自问："像教科书还是像演示？"）
- [ ] 章节编号是否连续
- [ ] 文件名（中文）= frontmatter title
- [ ] 行数是否超过 1000（>1000 关注 / >1500 必拆）
- [ ] "已沉淀"声称是否对应实际写入

详见 [CLAUDE.md 索引段](../../../CLAUDE.md)。
