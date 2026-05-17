---
name: project-knowledge-base
description: 通过AI对话自动构建个人知识库，git+md形式，主题分类+时间线双轨制
type: project
lastUpdated: 2026-05-17originSessionId: ff641dae-a73b-4600-9f28-4c7bd678dcac
---
项目 `ans-ai-auto-notes` 旨在通过与 AI 对话逐步沉淀个人知识库。
采用 git + markdown 形式，主题分类（技术/读书笔记/日常思考/action）和时间线按周归档双轨并行。
已有入口文件：INDEX.md（总目录）、overview.html（可视化导览，支持右侧 TOC 目录）。

**更新策略**：混合模式 — 小知识点自动追加，大改动（拆分/合并/重组）主动提案待确认。

**文件拆分阈值**（已写入 CLAUDE.md，任意两条触发）：
- 行数 > 350
- `##` 级章节 > 5-6
- 覆盖 3+ 个可独立成文的方向

**已拆分经验**：llm.md（1143 行 → llm.md + llm-prompt-rag.md + llm-agent-mcp.md，3 文件）。

**Why:** 用户希望在不打断对话流的情况下自动积累结构化知识，同时保留对重大改动的掌控权。

**How to apply:** 每次对话后自动提取知识点写入对应文件；发现文件过大或结构需调整时主动提案。笔记风格必须是带 Demo 的对话式讲解，不是教科书定义。
