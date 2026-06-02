---
name: feedback-physical-structure-over-metadata
description: 分类/分组优先用物理目录结构，不要用 frontmatter 字段或脚本逻辑做隐式分组——磁盘结构 = 视觉结构最稳，最不容易漂移
metadata: 
  node_type: memory
  type: feedback
  lastUpdated: 2026-05-18
  originSessionId: 5dee47af-aa5a-4c55-ac2d-382ce77a3b18
---

**规则：当一个分类/分组决策有"物理目录拆分 vs frontmatter 字段标记 vs 脚本前缀识别"几个选择时，默认选物理目录拆分。**

**Why:**
- 2026-05-18 我在解决"AI 子树 应用生态/ 一个目录 14 篇文件臃肿"问题时，给出 3 个方案：
  - A. 物理拆分（git mv 12 文件到新子目录） — 重 / 一次性付出
  - B. 给 frontmatter 加 `category:` 字段，build-index.js 按 category 分组渲染 — 轻
  - C. build-index.js 检测文件名前缀（`claude-code-*`/`ai-coding-*`）自动分小节 — 最轻
- 用户选了 A（物理拆分），明确拒绝 B/C
- 也对应 Phase 1 review 时用户认可的清理动作：删除 6 个文件中冗余的 `tags`/`related` frontmatter，统一回到只有 `title`+`description`

**How to apply:**
- 知识分类决策默认选物理目录
- 不要建议"用 frontmatter 字段实现 X"，除非已经无法靠物理结构解决
- 不要建议"用脚本逻辑/正则推断分组"——那把信息藏在了 build 脚本里，未来 AI 改文件时不一定记得保持一致
- frontmatter 保持精简：只放 `title` + `description`（被 build-index.js 消费的最小集）；其他元数据（关联、标签）走正文 `> 关联:` 行
