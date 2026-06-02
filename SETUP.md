# SETUP — 新设备 onboarding

## 一键 bootstrap

```bash
git clone <this-repo>
cd ans-ai-auto-notes
bash bootstrap.sh
```

bootstrap.sh 会自动完成：

1. 探测 Claude Code 安装状态
2. 安装 git pre-push hook
3. 检查全局 `~/.claude/settings.json`
4. 初始化 memory（从 `.claude/memory-snapshot/` 同步到 `~/.claude/projects/.../memory/`）
5. 构建 `manifest.json` + `INDEX.md` + `timeline.json`
6. 跑测试验证

## 手动 setup（如 bootstrap 失败）

### 1. 安装 Claude Code

参考官方文档：<https://docs.claude.com/claude-code>

### 2. 安装 git hook

```bash
bash scripts/install-hooks.sh
```

### 3. 配置全局 settings

如果 `~/.claude/settings.json` 不存在，创建最小配置：

```json
{ "theme": "dark" }
```

### 4. 同步 memory

```bash
bash scripts/sync-memory.sh
```

### 5. 构建索引

```bash
node scripts/build-index.js
node scripts/build-timeline.js
```

### 6. 跑测试

```bash
bash test.sh
```

## FAQ

### Q: bootstrap 报"claude 命令未找到"

A: 先安装 Claude Code 再跑 bootstrap：<https://docs.claude.com/claude-code>

### Q: memory 同步只同步部分文件？

A: 同步范围由 `.claude/memory-snapshot/.allowlist` 控制。每行一个文件名，`#` 开头为注释。新增 memory 文件需手动加入 allowlist 才会跨设备同步。

### Q: 跨设备同步流程？

A:

1. 设备 A 修改 memory → `bash scripts/sync-memory.sh` → push snapshot
2. 设备 B `git pull` → `bash scripts/sync-memory.sh` → 本地 memory 更新

mtime 较新者覆盖较旧者（rsync `--update` 语义），两端各自记录的修改时间决定胜负。

### Q: timeline.json 来自哪里？

A: `node scripts/build-timeline.js` 从 `git log --since="6 months ago"` 聚合按 ISO 周生成。已加入 `.gitignore`，每次重建即可，无需手维护。
