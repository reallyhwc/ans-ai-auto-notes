# Architecture Decision Records (ADR)

> 项目内重大架构决策、分类争议的归档。新决策追加 ADR，编号单调递增。
> 用途：让 AI 在分类摇摆或架构选择时有先例可循，避免目录漂移。

---

## ADR-001: AI 子树拆 5 个并列子目录（基础/大模型/Claude-Code/AI-Coding/应用）

- **日期**: 2026-05 起
- **状态**: 接受
- **背景**: kb/技术/AI/ 内容容易快速膨胀，单层目录文件数 >15 时混合多个子领域，AI 在分类时容易摇摆
- **选项**:
  - (a) 保持单层（按 frontmatter tag 分组）
  - (b) 拆 2 个子目录（基础 / 应用）
  - (c) 拆 5 个并列子目录（基础/大模型/Claude-Code/AI-Coding/应用）
- **决定**: (c)
- **理由**:
  - 5 个子领域边界清晰，每个 ≥3 文件
  - **物理目录拆分优于 metadata 字段**（见 ADR-003）
  - manifest + INDEX 由 build-index 自动生成，目录就是分类
  - AI 写新笔记时，目录路径就是分类提示，不需要额外判断

## ADR-002: 零 npm 依赖原则

- **日期**: 2026-05 起
- **状态**: 接受
- **背景**: KB 项目本质是 markdown + 简单脚本，引入 npm 依赖会带来：
  - package.json / node_modules 维护成本
  - 跨设备 onboarding 复杂度增加（npm install / 版本锁定）
  - 长期维护时供应链风险（依赖 deprecated / 安全漏洞）
- **选项**:
  - (a) 自由用 npm 包（react / marked / lunr 等成熟工具）
  - (b) 用 CDN 引入第三方库到浏览器 + Node 内置模块写脚本
  - (c) 完全零依赖，自己实现需要的工具
- **决定**: (b)
- **理由**:
  - 浏览器层：marked / mermaid 通过 CDN 引入，runtime 加载，不污染源码
  - 工具层：bash + Node 内置 (`fs/path/child_process`)，覆盖 95% 需求
  - 5% 复杂场景（如解析 YAML / 全文搜索）选择**手写而非引入** —— 可控且代码量都在可读范围
  - 由 `scripts/arch-lint.sh [9/15]` 自动检查脚本中是否有 `npm/yarn/pnpm` 调用
- **豁免**: 行内注释 `# ALLOW-DEP` 可以放行（应该极少用）

## ADR-003: 物理目录拆分优于 metadata 字段

- **日期**: 2026-05 起
- **状态**: 接受
- **背景**: 给 KB 内容分类有两种方法：
  - 物理目录：`kb/技术/AI/Claude-Code/xxx.md`
  - Metadata 字段：单一目录 + frontmatter `tags: [AI, Claude-Code]`
- **选项**:
  - (a) 物理目录优先，metadata 字段辅助
  - (b) Metadata 字段优先，目录扁平
  - (c) 完全用 metadata，不分目录
- **决定**: (a)
- **理由**:
  - 物理路径是**唯一确定的**，metadata 是**主观可漂移的**
  - AI 写新笔记时，目录路径直接显示在 file_path 参数中，分类天然清晰
  - manifest.json + INDEX.md 由 build-index 扫描目录树自动生成，无需 metadata 解析
  - Frontmatter 仅保留 `title` + `description`（最小集），分类信息靠目录
  - 跨子目录关联用 `> 关联: ../xxx/yyy.md` 显式链接，比隐式 tag 关联更可见
- **关联**: 用户偏好 `feedback-physical-structure-over-metadata`（如有 memory 系统）

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

## 何时写 ADR

- **必写**：架构层面决策（目录拆分、技术栈选择、跨子系统接口设计）
- **必写**：分类争议（同一笔记可放 A 也可放 B 时，决定后追加 ADR 给后续 AI 看）
- **建议写**：明显违反"自然做法"的决策（"为什么不用 X"），后人会问的问题
- **不必写**：文件级实现细节（用 var 还是 let）、个人风格选择

## 在哪里看 ADR

CLAUDE.md 中「决策先例」段会引用本文件。AI 在写入 kb/ 或调整目录结构前，遇到分类歧义时会先查这里。
