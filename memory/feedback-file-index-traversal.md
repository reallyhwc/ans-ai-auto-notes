# Feedback: FILE_INDEX 结构升级时必须同步全部遍历函数

> 来源: 2026-05-07 修复 AI/机器学习 三层目录后的踩坑沉淀

## 问题

`overview.html` 中 4 个独立函数都遍历 `FILE_INDEX.categories`，且都硬编码了两层 `forEach`：

| 函数 | 用途 |
|------|------|
| `renderCategories()` | 渲染左侧分类树 |
| `buildFileIndex()` | path → {title, desc} 映射，给 viewContent 用 |
| `searchKB()` | 全文搜索 |
| `checkServer()` | 用 fetch 探测某个具体 md 文件是否能加载 |

`commit 7463507` 把 AI/机器学习 从两层重构为三层（基础/大模型/应用生态）后，4 个函数全部翻车，但症状各不相同（不显示 / 点击无反应 / 搜不到 / 误判服务器不可用），逐一被用户报上来才修。

## 规则

每当 `FILE_INDEX` 的层级结构发生变化时，必须执行：

```bash
grep -n 'FILE_INDEX' overview.html
```

把所有遍历它的函数列出来，**逐一确认**是否需要同步升级。不要"修完报错的那个就停"。

## 自动化兜底

已沉淀 `scripts/check-overview.js`，包含一项检查："buildFileIndex / searchKB / renderCategories 三者对同一组文件输出一致结果"。`exit-check.sh` 在退出前会自动跑这个脚本，下次类似问题会被自动拦截。

## 类似的兜底原则

不仅 FILE_INDEX，任何全局数据结构（如未来可能新增的 TAG_INDEX、CROSS_REF_MAP 等）发生升级时，都应：
1. grep 找出所有访问该结构的代码
2. 同步升级
3. 在 `scripts/check-overview.js` 中加一项一致性断言
