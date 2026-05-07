# Feedback: 菜单嵌套层级的 CSS 视觉上限

> 来源: 2026-05-07 用户问"以后菜单层级如果有 10 层，HTML 能兼容么？"

## 结论速查

| 维度 | 上限 | 说明 |
|------|------|------|
| **JS 逻辑** | 几乎无限 | 4 个遍历函数（renderNode/buildFileIndex/searchKB/checkServer）已全部递归化，理论上嵌套到 V8 调用栈极限（~10000 层）才会爆 |
| **CSS 视觉** | ~5-6 层 | sidebar 总宽 200px，`.tree-children { margin-left: 16px }` 每层累加，5 层后左边距 80px 文字区只剩 120px，6 层后明显挤压 |

## 当前 CSS 关键值

```css
.sidebar { width: 200px; }
.tree-children { margin-left: 16px; }
.tree-file { margin-left: 20px; ... }
```

## 真要支持深层嵌套（≥6 层）时的可行方案

按推荐度排序：

1. **在数据层就拆**：知识库本身保持 ≤4 层（领域 → 子领域 → 子子领域 → 文件），如果一定要更深，就把深的那部分独立成单独的 md 文件而不是挂更深的目录
2. **缩进上限**：CSS 加 `max-depth-N` 类，超过 N 层后 `margin-left: 0`，靠折叠图标的样式区分层级
3. **切换面包屑**：深层节点不展开树，而是显示"基础 / 大模型 / xxx / yyy / 当前文件"的面包屑
4. **sidebar 拓宽 + 字号递减**：`.sidebar { width: 280px }`，第 N 层 `font-size: max(11px, 14px - N)`

## 何时需要做？

**当前不必做**。本知识库实际场景（按主题分类的笔记库）几乎不会超过 4 层。只在出现"已经达到 5 层但仍要继续加深"的实际需求时再动手。

## 自动化提醒

如果未来 `FILE_INDEX` 出现 ≥6 层嵌套，可以在 `scripts/check-overview.js` 中加一项："最大嵌套深度告警"，不阻断流程但提示。
