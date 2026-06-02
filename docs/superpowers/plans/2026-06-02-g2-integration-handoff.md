---
title: G2 集成阶段交接清单（self-audit 输出）
description: G2 worktree 完成后的自审计发现，分类整理，标注哪些已在 G2 内修、哪些需集成阶段（Task 18）处理
date: 2026-06-02
status: 待集成处理
related:
  - 2026-06-01-kb-system-uplift-plan.md (master plan, Task 18 集成)
---

# G2 集成阶段交接清单

> 本文件由 G2 执行 + 自审计后生成。约定：**当前分支可修的已修；只有跨分支/集成阶段才能合理处理的列在这里。**
> 集成阶段（Task 18）合 G2 时请通读本文件，按列表项逐一处理。

## 已在 G2 worktree 内完成的修复

不需要集成阶段重复处理。这一段只是上下文。

| commit | 修复内容 |
|---|---|
| `01bdcd4` | verify-claim.sh hook 输入协议（env var → stdin JSON） |
| `01bdcd4` | session-log.test.js 测试隔离（GIT_DIR/GIT_WORK_TREE + 同步 rmSync）|
| `01bdcd4` | check-content-quality.sh 白名单 case pattern 收紧（必须带 `/`）|

> **背景**：G2 推进过程中发生过 origin/worktree-kb-uplift-g2-hook 被 13 个 a.txt 测试 commit 污染（force-push 已清理，origin tip = `01bdcd4`）。根因是测试 setTimeout 异步清理 + cwd 隔离不足。已加固。

---

## 集成阶段必须处理的事项（TODO）

### 1. 🚨 PostToolUse hook 跨机器同步缺失

**症状**：新设备克隆 repo，verify-claim.sh 文件存在，但 PostToolUse hook 不会自动 attach。

**原因**：
- 项目约定 hook 配置在 `.claude/settings.local.json`
- `.claude/` 整体被 `.gitignore` 忽略（line 23）
- 我在 G2 内加的 PostToolUse 段只在本机生效，未入 git

**集成阶段方案选择**（按推荐度排序）：

#### 方案 A（推荐）：bootstrap.sh 写入 PostToolUse hook
G4 的 `bootstrap.sh` 在新机器初始化时，检测 `.claude/settings.local.json` 是否含 PostToolUse 段；若没有，注入：

```json
"PostToolUse": [
  {
    "matcher": "Write|Edit",
    "hooks": [
      { "type": "command", "command": "bash scripts/verify-claim.sh", "timeout": 10 }
    ]
  }
]
```

注入逻辑可用 `python3 -c` 解析 + 改写 JSON（保持零 npm 依赖）。

#### 方案 B：迁移到 `.claude/settings.json`（committed）
把 PostToolUse hook 段从 settings.local.json 搬到 settings.json，加入 git 追踪。但这改了项目既有约定（hook 都在 local 文件中），需要顺带把 SessionStart/Stop hook 也搬。范围扩散。

#### 方案 C：写入项目根 `hooks-template.json` + bootstrap.sh 复制
新建一个 committed 的 `.claude/hooks-template.json` 作为参考；bootstrap.sh 用它生成 settings.local.json。这是 A/B 的折中。

**建议**：选方案 A（最小改动）。在 G4 bootstrap.sh 里加一个 step "ensure PostToolUse hook"。

---

### 2. ⚠️ arch-lint [10/15] 在跨机环境会误报 verify-claim.sh 为孤儿脚本

**症状**：在没有 settings.local.json 的机器（如 CI、新克隆）上跑 `bash scripts/arch-lint.sh`，[10/15] "脚本被引用一致性" 会把 `scripts/verify-claim.sh` 标为孤儿脚本。

**根因**：[10/15] 检查的 REFERENCING 白名单包括 `.claude/settings.local.json`，但该文件在新机器上未必存在。

**当前状态**：本机 lint 通过（因为 settings.local.json 存在）。但稳定性差。

**集成阶段方案**（与上面的 PostToolUse 同步方案绑定）：

- 若上面选方案 A（bootstrap 注入）：把 bootstrap 步骤跑在 lint 之前；或在 [10/15] 的 REFERENCING 中追加 bootstrap 模板路径
- 若选方案 B（迁到 settings.json）：自动解决
- 兜底：在 `scripts/arch-lint.sh:[10/15]` 的逻辑里，**显式把 verify-claim.sh 加豁免**（脚本顶部加注释 `# Hook script: managed via PostToolUse, not by direct invocation`，arch-lint 检测此注释跳过）。这种豁免机制更通用。

---

### 3. ⚠️ arch-lint 编号集成时需要统一

**当前 G2 内**：arch-lint 编号 `[N/15]`（基于 G1 已合入的 [14/14] anchor 之上 +1）。

**潜在冲突**：
- G3/G4/G5 worktree 是否也在 arch-lint 加新 check？我无法看其他 worktree。
- 若 G3 也加 [15/15]，rebase 时会冲突。
- 若 G4/G5 加新 check，集成顺序 G3 → G4 → G5 时各自基于前一组的编号 +1。

**集成阶段操作**：
1. 集成 G2 后跑一次 `grep -E "/[0-9]+\]" scripts/arch-lint.sh | head -20`，确认编号连续
2. 集成 G3 前，先看 G3 worktree 的 arch-lint.sh 改动（`git log --oneline --diff-filter=M kb-uplift-g3-skills -- scripts/arch-lint.sh`）
3. 若有冲突，按 G2 → G3 → G4 → G5 顺序，每组改动叠加 +1

---

### 4. 💭 .gitignore 显式条目（信息级，可不做）

**plan 原始要求**（Task 6 Step 5、Task 8 Step 3）：
```
echo ".claude/session-logs/.last-checkpoint" >> .gitignore
echo ".claude/claim-ledger.log" >> .gitignore
```

**G2 实际**：跳过。理由：`.claude/` 整体已 gitignored（`.gitignore:23`），子文件冗余。

**集成阶段考量**：
- 如果 G4 改 `.claude/` ignore 规则（例如加 `!.claude/memory-snapshot/`），需重新审视这两个 runtime 文件是否还在 ignore 范围内
- 若改后不在 ignore 范围，必须显式添加这两条
- G4 的 plan 提到 "memory-snapshot/" 入 git，所以可能确实会改 `.claude/` 规则

**建议**：集成 G4 后跑 `git check-ignore -v .claude/session-logs/.last-checkpoint .claude/claim-ledger.log` 验证；若不再被 ignore，添加显式条目。

---

### 5. 💭 lib.js 的 stripInline export 契约（信息级，G1 已处理）

仅作为提醒。G1 已把 `stripInline` 提到 top-level 并 export。G2 没动 lib.js。集成时不冲突。

---

## 验证清单（集成 G2 后跑一遍）

```bash
# 1. 核心测试
bash test.sh                            # 期望 85+ tests pass

# 2. 架构检查
bash scripts/arch-lint.sh               # 期望 0 errors

# 3. 退出检查
bash exit-check.sh                      # 期望各项 ✓

# 4. PostToolUse hook 真实触发验证
echo '{"tool_name":"Edit","tool_input":{"file_path":"kb/不存在.md"}}' | bash scripts/verify-claim.sh
cat .claude/claim-ledger.log            # 期望 MISSING 行

# 5. session-log 触发验证
git log --oneline -1 > .claude/session-logs/.last-checkpoint  # 模拟有 checkpoint
bash scripts/session-log.sh             # 期望 "[session-log] 跳过" 或写日志
```

---

## 如果集成发现新问题

按 G5 的先例（commit `9cf9c27` "G5 执行后审计发现归档"），集成阶段如发现新问题，直接在本文件追加 section 即可，不必新建文件。

