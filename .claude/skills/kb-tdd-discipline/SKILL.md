---
name: kb-tdd-discipline
description: Use when modifying any file under scripts/ or tests/ in this ANS AI Auto Notes project. Also use when fixing any bug in markdown rendering, path resolution, frontmatter parsing, or static lint scripts. Enforces red-green-refactor cycle and bug-reproduction-test-first.
---

# KB TDD Discipline (ANS AI Auto Notes 项目)

## 触发条件

**MUST invoke when**:
- 修改 `scripts/*.{sh,js}` 文件
- 修改 `tests/*.test.js` 文件
- 修复以下区域的 bug（错误趋向区域）：
  - markdown 渲染链路（marked 配置、自定义 renderer 如 renderKbLink）
  - 路径解析（resolveRelativeMd、build-index 扫描）
  - frontmatter 解析（build-index.js）
  - 静态校验脚本（check-overview.js、arch-lint.sh）

## 软 TDD 流程

### 错误趋向区域：先红后绿
1. **写一个失败测试**：能复现问题
2. **跑测试确认失败**（红）— `node --test tests/xxx.test.js`
3. **写最小实现**让测试通过
4. **跑测试确认通过**（绿）
5. **重构**（可选）
6. **Commit**

### Bug 修复：先复现再修
1. 先在 `tests/` 加一个能复现该 bug 的失败测试
2. 跑测试确认 fail（即 bug 真实存在）
3. 修 code 让测试转绿
4. Commit（msg 含 `fix: xxx`）

## 豁免（不强制 TDD）

- 纯文本编辑：kb/*.md、CLAUDE.md、README 等内容修订
- UI 样式调整：overview.html 的 CSS
- 配置变更：settings.local.json、.gitignore

## 测试入口

- 推荐：`bash test.sh`（spec reporter）
- 直接：`node --test tests/*.test.js`
- 单文件：`node --test tests/lib.test.js`

## 测试文件组织

```
tests/
├── lib.test.js              ← scripts/lib.js 纯函数
├── link-renderer.test.js    ← marked link renderer 输出契约
├── build-index.test.js      ← manifest.json 数据完整性
└── integration.test.js      ← 全量 kb/ markdown 链接静态解析
```

**命名约定**：新测试按"被测对象"命名 `<source>.test.js`。

**Node 中可用的纯逻辑**：统一放 `scripts/lib.js`（UMD 双导出，浏览器和 Node 都能加载）。

## Push 前自动跑测试（双层 gate）

1. **`scripts/git-hooks/pre-push`** — git 层硬拦截
2. **`exit-check.sh` 的 auto-push 块** — Stop 时 ≥5 commits 未 push 时先跑 test 通过才 push

**首次安装 hook**：`bash scripts/install-hooks.sh`（新机器克隆后跑一次）。

## 反面案例

- ❌ "改了脚本但没加测试，下次出 bug 不知道为什么" → 应先加 failing test 再改 code
- ❌ "测试随便写一行，主要是为了 git 不报错" → 测试要真验证行为，不只是 assert.ok(true)
- ❌ "跳过 pre-push hook 因为测试'肯定能过'" → 不允许 --no-verify

## 自检 Checklist

- [ ] 修改 scripts/ 时是否有对应 test 文件？
- [ ] 修 bug 时是否先加复现 test？
- [ ] 新逻辑是否走完整的红→绿→重构循环？
- [ ] push 前 `bash test.sh` 全绿？

详见 [CLAUDE.md 索引段](../../../CLAUDE.md)。
