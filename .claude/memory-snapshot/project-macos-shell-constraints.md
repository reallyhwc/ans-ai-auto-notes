---
name: project-macos-shell-constraints
description: 本机（macOS）默认 bash/coreutils 有几个非显而易见的限制，写 scripts/*.sh 时容易踩坑——bash 3.2 无关联数组、无 GNU timeout、BSD realpath 无 -m、文件系统大小写不敏感
metadata: 
  node_type: memory
  type: project
  lastUpdated: 2026-07-29
  originSessionId: e6385508-9b6a-4052-8c40-5cd828a4f78e
  modified: 2026-07-29T05:43:55.753Z
---

写这个项目的 shell 脚本（尤其 `scripts/*.sh`、hook 相关）时，本机环境有几个和"标准 Linux + GNU coreutils"假设不一致的地方，2026-07-29 这次 harness 架构审计里连续踩了三个坑才摸清：

1. **默认 `/bin/bash` 是 3.2.57**（Apple 因 GPLv3 许可问题多年未升级），**不支持 `declare -A`**（关联数组，bash 4.0 才有）。需要哈希表语义时用两个并行的普通数组（一个存 key，一个存 value）+ 线性查找函数模拟，不要假设 `declare -A` 能用。
2. **没有 GNU `timeout`/`gtimeout`**（`which timeout` 查不到）。给可能挂起的命令加超时保护，不要在脚本内部包 `timeout N cmd`——改用 Claude Code hook 配置本身的 `"timeout": N`（settings.json/settings.local.json 的 hook 对象字段），由 harness 强制杀掉整个进程树。
3. **BSD `realpath` 没有 `-m` 选项**（GNU realpath 才有，用于"路径不需要真实存在也能规范化"）。`realpath -m` 在这台机器上会 `illegal option` 报错。需要折叠 `.`/`..` 时自己写纯 bash 数组栈实现（push 普通段、遇 `..` pop 一个），不要依赖 `realpath -m`。
4. **APFS 默认大小写不敏感（但保留大小写）**：`[ -e "$path" ]` 对 `"Foo"` 和 `"foo"` 都返回真。任何需要真正区分大小写的检测（比如 arch-lint 检查链接大小写是否匹配磁盘，Linux/GitHub 是大小写敏感的）不能用 `[ -e ]`/`find`（不加 `-name` 精确匹配也一样）判断"是否精确匹配"，必须读一次目录列表（`ls -1A`）后用 bash 字符串比较（天然大小写敏感）逐个比对。

**Why**：这次审计发现 `scripts/arch-lint.sh` 的检查 6（链接大小写一致性）因为踩了 #3（`realpath -m` 静默失败）+ #4（`[ -e ]` 大小写不敏感）两个坑，**从写出来那天起就没真正检测出过任何 `../` 链接的大小写问题**——不是性能 bug，是彻底失效，只是没人发现因为它"看起来正常输出、只是从不报警"。

**How to apply**：改/写这个项目的 shell 脚本前，先假设"只有 bash 3.2 + BSD coreutils + 大小写不敏感文件系统"，不要照抄网上假设 GNU 环境的 bash 代码片段。改完用 `bash --version` 确认，涉及路径/大小写判断的逻辑最好补一个用临时目录构造的正确性测试（不能只测"跑起来不报错"，要测"真的检测出该检测的问题"）。
