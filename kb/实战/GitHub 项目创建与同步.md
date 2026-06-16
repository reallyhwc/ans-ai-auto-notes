---
title: "GitHub 项目创建与同步"
description: "SSH key 配置、仓库初始化、CI 基础"
---

# GitHub 项目创建与同步

> 最后整理: 2026-05-05 | 来源: 多轮对话实操踩坑

> 关联: [overview.html 踩坑记录](<./overview.html 踩坑记录.md>) — 本项目可视化导览页维护踩坑

## 从零创建 GitHub 仓库并推送

### 1. 在 GitHub 创建空仓库

打开 [github.com/new](https://github.com/new)，填好名字，**不要勾选** README / .gitignore / License（本地已有）。

### 2. SSH 密钥配置

生成 ED25519 密钥（比 RSA 更快更安全）：

```bash
# -f 指定文件名，-C 加注释
ssh-keygen -t ed25519 -C "your@email.com" -f ~/.ssh/id_ed25519_github

# 提示 Enter passphrase 时直接回车跳过（不设密码，免去每次输入）
```

复制公钥：

```bash
cat ~/.ssh/id_ed25519_github.pub
```

打开 [github.com/settings/keys](https://github.com/settings/keys) → New SSH Key → 粘贴 → 保存。

### 3. 本地 repo 关联远程（repo 级别，不影响其他项目）

不想全局覆盖 `~/.ssh/config`（怕影响其他项目用旧密钥），用 repo 级别的 `core.sshCommand`：

```bash
git config core.sshCommand "ssh -i ~/.ssh/id_ed25519_github -o IdentitiesOnly=yes"
git remote add origin git@github.com:用户名/仓库名.git
git push -u origin main
```

这样只在这个 repo 用新密钥，其他项目继续用默认 `id_rsa`。

### 4. 以后每次推送

```bash
git push
```

首次推送用了 `-u` 建立 upstream 关联，之后只需 `git push`。

---

## 踩坑记录

### 坑 1：`Enter passphrase for key` 弹密码提示

生成密钥时设了 passphrase，每次 push 都要输。解决方案：

- **方案 A**：重新生成一个不设密码的密钥（见上面第 2 步），用 `git config core.sshCommand` 指定
- **方案 B**：把密码存 macOS 钥匙串：`ssh-add --apple-use-keychain ~/.ssh/id_rsa`

### 坑 2：HTTPS 协议报 `Invalid username or token`

GitHub 2021 年起禁用密码认证，必须用 Personal Access Token：

1. [github.com/settings/tokens](https://github.com/settings/tokens) → Generate new token (classic)
2. 勾选 `repo` 权限
3. 生成后立即复制 `ghp_xxx` token（关掉页面就看不到了）
4. git push 时用户名填 GitHub 用户名，密码填 token

**但更好用 SSH**（方案一劳永逸，不用记 token）。

### 坑 3：SSH 生成了新密钥，系统仍用旧 `id_rsa`

SSH agent 缓存了旧密钥。用 `core.sshCommand`（第 3 步）强制目标 repo 走指定密钥，不改全局配置。

### 坑 4：仓库已创建但忘记不勾 README

GitHub 默认勾选 "Add a README file"，如果勾了会和本地 commit 冲突。解决：

```bash
git pull origin main --rebase   # 拉取远端 README 并合并
git push
```

或者创建时直接取消所有勾选（推荐）。

---

## `.gitignore` 保底

确认 `.gitignore` 排除了敏感文件：

```gitignore
# Claude Code
.claude/        ← settings.local.json 含 API key，绝对不能提交
.worktrees/

# IDE
.idea/
.vscode/

# macOS
.DS_Store
```

检查方法：`git status` 看有没有不该出现的文件。

---

> 关联: [CLAUDE.md](../../CLAUDE.md) — Git 规则
