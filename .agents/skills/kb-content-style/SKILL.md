---
name: kb-content-style
description: Use when writing or editing any markdown file under kb/ in this ANS AI Auto Notes project.
---

# KB Content Style (ANS AI Auto Notes 项目)

## 触发条件

**MUST invoke when**:
- 写入 / 编辑 `kb/` 目录下任何 .md 文件
- 准备拆分 kb/ 文件时
- 给新的 kb/ 笔记起文件名时

## 核心笔记风格要点

- **保留 demo 和示例**：保留对话中的具体例子、图解、类比，反对干瘪总结
- **Mermaid 优先**：画图优先 ` ```mermaid `（overview.html 渲染为 SVG）；ASCII 框图仅 Mermaid 不适用时用
- **重组而非堆砌**：同主题持续归纳合并为自上而下的结构化文档，不堆同日期小节
- **反抽象化**：像教科书定义 = 太抽象；像拿草稿纸演示 = 对

## 自动沉淀，不询问（强制性）

对话中产生的技术讲解、概念梳理、方案对比，**直接写入 kb/ 对应文件，同一条消息完成**，绝不问"要不要沉淀？"。唯一例外：文件拆分/合并/重组/目录变更 → 提案（给方案让用户选，不是问"要不要做"）。

## 行数只提示，不提案拆分

>1000 关注、>1500 同样只是提示，**不擅自提案拆分**——拆分决策权归用户。

## 严禁口头沉淀

声称"已沉淀到 xxx.md"前，**必须 Read 确认文件存在**。

## 自检 Checklist

- [ ] 无格式破损（重复段落 / 裸奔代码 / 列表挤压）？
- [ ] 控制台已给出完整可读回答（不能只有文件索引）？
- [ ] 没问"要不要沉淀？"（问了即违规）？
- [ ] 含 mermaid / 代码块 / 表格 任一？
- [ ] 不抽象（"像教科书还是像演示？"）？章节编号连续？文件名 = frontmatter title？
- [ ] 行数 >1000 只提示不拆？"已沉淀"对应实际写入？

## 细节参考

- 文件拆分规则全文、中文文件名细则、双输出原则全文、跨文件关联细则、判断标准示例 → [reference.md](./reference.md)
- arch-lint 修复指南 → [arch-lint-fix-guide skill](../arch-lint-fix-guide/SKILL.md)
