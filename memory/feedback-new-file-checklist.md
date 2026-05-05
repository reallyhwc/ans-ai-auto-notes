# Feedback: 新增文件必做清单

> 来源: 2026-05-05 用户用 Claude Code + DS 审计发现遗漏

## 问题

新建 `kb/action/技巧/knowledge-management-tools.md` 时，只更新了 INDEX.md 和 timeline，**漏掉了两件事**：

1. **双向链接缺失**：新文件中写了指向 `ai-agent-tools.md` 和 `ai-coding-ides.md` 的关联链接，但没有回去在那两个文件中补上反向链接。链接必须是**双向**的。
2. **overview.html FILE_INDEX 未更新**：新增 md 文件后，必须在 `overview.html` 的 `FILE_INDEX` JSON 中添加对应条目，否则浏览器预览页看不到新文件。

## 规则（新增 md 文件时的完整清单）

每次新建 kb/ 下的 md 文件，必须完成以下 **全部四项**：

1. ✅ 更新 `INDEX.md` — 添加索引条目
2. ✅ 更新 `timeline/YYYY-WXX.md` — 记录对话摘要
3. ⚠️ 更新 `overview.html` 的 `FILE_INDEX` — 添加 JSON 元数据条目
4. ⚠️ 补全双向链接 — 新文件中引用了哪些文件，就去那些文件的 `> 关联:` 行补上反向链接

第 3、4 项是本次被审计出来的遗漏，必须牢记。
