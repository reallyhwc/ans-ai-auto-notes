---
name: feedback-zero-npm-deps
description: 项目坚持零 npm 依赖——不要轻易引入 package.json/node_modules；优先用 Node 内置 API、vendoring、vanilla 方案
metadata: 
  node_type: memory
  type: feedback
  lastUpdated: 2026-05-18
  originSessionId: 5dee47af-aa5a-4c55-ac2d-382ce77a3b18
---

**规则：项目所有 Node 工具链坚持零 npm 依赖。引入 package.json 之前必须有强理由。**

**Why:**
- 2026-05-18 第一次审计中我加了 package.json（锁定 markdownlint-cli 版本），用户在 review 时让我删掉，理由："项目根本不装 node_modules，npx --yes 兜底足够"
- 同日设计 TDD 体系时，用户在测试框架选项中再次明确选"vanilla `node --test`（零依赖）"，拒绝 Vitest（`需 package.json + node_modules`）
- 两次都是同一个原则：**避免 Node 工具链给单用户项目带来维护负担**——更新依赖、锁定版本、CI 配置都是成本

**How to apply:**
- **优先级 1**：Node 内置（`node --test`、`node:fs`、`fetch` 等 Node 22+ API）
- **优先级 2**：vendoring（一次性下载库到 `vendor/`，例如 marked.min.js）
- **优先级 3**：可选依赖兜底（如 `lint.sh` 的 `npx --yes markdownlint-cli` —— 用户没装也能跑，装了走快路径）
- **最后才考虑**：加 package.json + npm install。**且必须先和用户确认**

**反例**：不要看到"加个测试" → 上来就 `npm install jest`。不要看到"做格式检查" → 上来就 `npm install prettier`。先看 Node 内置和已有工具能不能解决
