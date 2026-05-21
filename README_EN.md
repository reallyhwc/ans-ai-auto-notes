[中文](README.md) | **English**

# AI Auto Notes Template — Fork-and-Go AI Knowledge Base Scaffold

> Fork this repo, fill in your background, then chat with AI — your knowledge base grows automatically. Zero manual organizing, fully local.

[:books: Browse Knowledge Base →](INDEX.md) &nbsp;|&nbsp; [:bar_chart: Visual Overview](http://localhost:8765/overview.html)

## What Is This?

This is a **ready-to-use AI knowledge base template**. After forking, every conversation with Claude Code automatically classifies, summarizes, and organizes content into your own structured Markdown knowledge base.

**Core Philosophy: You don't take notes — AI does. You just chat.**

## Quick Start (3 Steps)

```bash
# 1. Fork & Clone
git clone git@github.com:<your-username>/ans-ai-auto-notes.git
cd ans-ai-auto-notes

# 2. Fill in your background (AI adapts its style accordingly)
#    Edit the "User Background" section in CLAUDE.md
#    Edit memory/user-profile.md with your details

# 3. Start chatting — knowledge base grows automatically
claude
```

That's it. AI will automatically:
- Extract knowledge points → write to `kb/` topic files
- Auto Git commit → commit after each batch of changes
- When files get too large → proactively propose splits
- On exit → automatically run health checks

## Features

- **Auto-Extraction**: AI identifies what's worth recording without prompting
- **Smart Aggregation**: Same-topic knowledge appended to same file, continuously reorganized
- **Proactive Divergence**: AI doesn't just answer — it suggests "Want me to record X too?"
- **Three-Layer Constraints**: Harness Engineering — rules enforced mechanically via hooks
- **Visual Overview**: Local preview with category browsing, timeline, search, word cloud, Mermaid diagrams
- **Zero Network Dependency**: All frontend resources vendored locally, instant offline access
- **Fully Local**: All data in local Git repo — you have 100% control
- **Auto File Management**: Auto-split proposals when files grow, auto-merge same topics

## Visual Overview

Run `./serve.sh` to launch the local preview page with:

- **Category Browsing**: Recursive tree display with expand/collapse
- **Timeline**: Weekly conversation summary archive with note links
- **Full-text Search + Word Cloud**: Keyword cloud before search, click to jump
- **Markdown Rendering**: Code highlighting, Mermaid diagrams, internal links, TOC
- **Live Reload**: Browser auto-refreshes on file changes
- **Dark Mode**: Follows system theme or manual toggle
- **Font Size**: Four levels (S/M/L/XL) one-click switch

All frontend dependencies vendored in `scripts/vendor/` — **zero network requests, instant offline**.

## Harness Engineering: Three-Layer Constraint System

**"Constraints > Documentation > Conversation"** — rules upgraded from "rely on saying" to "rely on execution":

```
Constraint Layer (Hooks)    → SessionStart preflight + Stop exit check + Architecture Linter
Documentation Layer (Files) → Session logs + Memory storage + Plan tracking
Conversation Layer (AI)     → CLAUDE.md rules + AI reasoning
```

| Layer | Trigger | What It Does |
|-------|---------|--------------|
| **Constraint** | SessionStart | Environment check + stale changes + memory expiry (>14d) + Architecture Linter |
| **Constraint** | Stop | Markdown lint + Git status + 12 health checks + Session log + Unpushed reminder |
| **Documentation** | Stop → File | Auto-generate session log from git diff |
| **Documentation** | Cross-Session | Layered memory with timestamps, >14 days auto-alert |

## Project Structure

```
ans-ai-auto-notes/
├── kb/                     # Knowledge base (your notes grow here)
│   ├── 技术/AI/            # AI-related (5 preset subdirectories)
│   ├── 技术/Java/          # Java tech stack
│   ├── 技术/计算机基础/     # CS fundamentals
│   ├── 实战/               # Hands-on tips & pitfall records
│   └── 读书笔记/           # Reading notes
├── timeline/               # Weekly conversation summaries (auto-generated)
├── memory/                 # AI memory (user profile, project rules, feedback)
├── scripts/                # Automation scripts (no changes needed)
│   ├── vendor/             # Frontend deps (mermaid / marked / wordcloud2)
│   ├── build-index.js      # Index builder
│   └── ...                 # lint / session-log / audit etc.
├── overview.html           # Visual overview page
├── server.js               # Local HTTP server (SSE live reload)
├── CLAUDE.md               # ⚠️ AI behavior rules (edit user background after fork)
└── timeline.json           # Timeline data
```

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (AI conversation engine)

## Common Commands

```bash
./serve.sh                    # Launch local preview (port 8765)
node scripts/build-index.js   # Rebuild manifest.json + INDEX.md
./lint.sh                     # markdownlint format check
node scripts/check-overview.js # 12 health checks
bash scripts/arch-lint.sh     # 8 KB architecture checks
```

## Customization Guide

After forking, you only need to modify these — everything else works out of the box:

| Must Change | File | Description |
|------------|------|-------------|
| **User Background** | `CLAUDE.md` → "User Background" | AI adapts style based on this |
| **Detailed Profile** | `memory/user-profile.md` | Career, tech stack, interests |

| Optional | File | Description |
|---------|------|-------------|
| KB Structure | `CLAUDE.md` → Directory rules | Default: Tech/Hands-on/Reading Notes |
| Split Threshold | `CLAUDE.md` → File split rules | Default: >1000 lines warn, >1500 must split |
| Note Style | `CLAUDE.md` → Note style rules | Default: QA style with demos |
| New Categories | Create dirs under `kb/` | AI auto-detects and classifies |

## Built-in Automation

| Capability | Description |
|-----------|-------------|
| **Auto Knowledge Extraction** | AI judges and records knowledge after each conversation |
| **Auto Git Commit** | Commits immediately after each batch of changes |
| **File Split Proposals** | AI proactively proposes splits when files >1000 lines |
| **Exit Health Checks** | 12 automated checks (lint / dead links / Git status etc.) |
| **Auto Index Rebuild** | INDEX.md updates when files are added/removed |
| **Memory Persistence** | AI remembers your preferences across sessions |

## Tech Stack

| Component | Technology | Description |
|-----------|-----------|-------------|
| AI Engine | Claude Code | Conversation-driven, auto knowledge distillation |
| Frontend | mermaid + marked + wordcloud2 | Diagrams/Markdown/Word cloud, all vendored |
| Server | Node.js (server.js) | Zero-dep HTTP + SSE live reload |
| Index | build-index.js | Scans kb/ → manifest.json |
| QA | arch-lint + check-overview + markdownlint | Hook auto-execution, CI-level local checks |
| Storage | Git + Pure Markdown | Full version control, zero lock-in |

## FAQ

**Q: Do I need to be a programmer to use this?**
A: Currently requires Node.js and Claude Code installation (some technical bar). But usage itself is zero-code — you just chat.

**Q: Can I change the directory structure?**
A: Yes. Directory structure under `kb/` is fully customizable — modify the rules in `CLAUDE.md`.

**Q: Will my knowledge base content be uploaded to the cloud?**
A: No. All data stays in your local Git repo. You choose whether to push to GitHub.

**Q: Can I use Cursor / Windsurf / other AI IDEs?**
A: This template is designed around Claude Code's Hooks system. Other AI tools don't support the full feature set yet.

## License

[MIT](LICENSE)