[中文](README.md) | **English**

# AI Auto Notes — Conversation-Driven Personal Knowledge Base

> Chat with AI, automatically distill into a structured knowledge base. Zero manual organizing, fully local, 38+ notes and growing.

[:books: Browse Knowledge Base →](INDEX.md) &nbsp;|&nbsp; [:bar_chart: Visual Overview](http://localhost:8765/overview.html)

## What Is This?

Every time you chat with Claude Code, the AI automatically classifies, summarizes, and organizes the content into a structured Markdown knowledge base. You just chat naturally—ask questions, discuss, learn—and the knowledge base grows in the background.

**Core Philosophy: You're not taking notes—AI is taking them for you.**

## 🚀 Want to Build Your Own Knowledge Base?

The `main` branch is the author's personal knowledge base (38+ notes). If you want to **build your own using the same architecture**, use the [`quickStart` branch](https://github.com/reallyhwc/ans-ai-auto-notes/tree/quickStart):

```bash
# 1. Fork this repo, then switch to quickStart branch
git clone git@github.com:<your-username>/ans-ai-auto-notes.git
cd ans-ai-auto-notes
git checkout quickStart

# 2. Fill in your background info
#    Edit "User Background" section in CLAUDE.md
#    Edit memory/user-profile.md

# 3. Start chatting — knowledge base grows automatically
claude
```

The `quickStart` branch retains the full feature architecture (visual overview, word cloud, search, auto-commit, file splitting, Hooks system, etc.) with all personal notes removed — a **ready-to-use template/scaffold**.

## Features

- **Auto-Extraction**: AI automatically identifies what's worth recording, without waiting for your prompt
- **Smart Aggregation**: Same-topic knowledge points are appended to the same file, continuously reorganized rather than piled up
- **Proactive Divergence**: AI doesn't just passively answer—it proactively suggests "Want me to record X as well?"
- **Three-Layer Constraint System**: Based on Harness Engineering principles, rules aren't just written in CLAUDE.md—they're mechanically enforced via hooks
- **Visual Overview**: One-click local preview with category browsing, timeline, full-text search, word cloud, and Mermaid diagram rendering
- **Zero Network Dependency**: All frontend resources (mermaid / marked / wordcloud2) are vendored locally, instant offline access
- **Fully Local**: All data stored in a local Git repository—you have 100% control

## Knowledge Base Overview

Currently accumulated **38+** structured notes covering the following areas:

| Category | Representative Notes |
|----------|---------------------|
| **AI / LLMs** | LLM principles, Agent & MCP protocol, Prompt & RAG, Multimodal, Fine-tuning & Deployment |
| **AI / Application Ecosystem** | AI Coding tool comparison, Team governance, Workflow platforms, Agent development practice |
| **AI / Claude-Code** | Architecture analysis, Harness Engineering, Advanced workflows, Remote Control |
| **Java Backend** | RocketMQ internals, Distributed transactions, Hot-account high-concurrency solutions, Spring AI |
| **CS Fundamentals** | Bayesian statistics, Turing & Von Neumann |
| **Hands-on** | overview.html pitfall records, GitHub repo setup |
| **Reading Notes** | "The Worlds I See", "The Logic of the World" |

## Visual Overview

Run `./serve.sh` to launch the local preview page, which provides:

- **Category Browsing**: Recursive tree display of all notes with expand/collapse
- **Timeline**: Weekly archive of conversation summaries with links to corresponding notes
- **Full-text Search + Word Cloud**: Keyword word cloud (powered by wordcloud2.js) displayed before search, click any word to jump to search
- **Markdown Rendering**: Code highlighting, Mermaid diagrams, internal link navigation, table of contents
- **Live Reload**: Browser auto-refreshes when files change
- **Dark Mode**: Follows system theme or manual toggle
- **Font Size Adjustment**: Four levels (S/M/L/XL) with one-click switching

All frontend dependencies (mermaid 3.3MB / marked 43KB / wordcloud2 37KB) are vendored in `scripts/vendor/` — **zero network requests, instant offline access**.

## Harness Engineering: Three-Layer Constraint System

The project adopts a **"Constraints > Documentation > Conversation"** three-layer model, upgrading rules from "rely on saying" to "rely on execution":

```
Constraint Layer (Hooks, mechanical execution) → SessionStart preflight + Stop exit check + Architecture Linter
Documentation Layer (File system persistence)  → Session logs + Memory layered storage + Plan state tracking
Conversation Layer (AI real-time understanding) → CLAUDE.md project rules + AI reasoning
```

| Layer | Trigger | What It Does |
|-------|---------|--------------|
| **Constraint** | SessionStart | Environment health check + stale changes reminder + memory expiry check (>14 days) + Architecture Linter (frontmatter / dead links / duplicate titles / line count / case consistency) |
| **Constraint** | Stop | Markdown lint + Git status + Health check (12 items) + Session log + Permission audit + Unpushed reminder (>5 auto push) |
| **Documentation** | Stop → File | Auto-generate structured session log from git diff, appending for same-day multiple sessions |
| **Documentation** | Cross-Session | Memory layered (stable/project/stream), all memories timestamped, >14 days auto-alert |

### Hook Script System

| Script | Trigger | Function |
|--------|---------|----------|
| `scripts/preflight.sh` | SessionStart | Last session summary, stale changes, manifest expiry, memory eviction, invoke arch-lint |
| `scripts/arch-lint.sh` | SessionStart | 8 KB architecture checks (frontmatter / dead links / line count / duplicate titles, etc.) |
| `exit-check.sh` | Stop | Chain lint + check-overview + session-log + permission-audit + unpushed check |
| `scripts/session-log.sh` | Stop | Auto-generate session log from git diff |
| `scripts/permission-audit.sh` | Stop | Scan scripts/ vs allowlist, suggest safe commands for whitelisting |
| `scripts/check-overview.js` | Stop | 12 health checks (data integrity, links, line count, etc.) |
| `scripts/build-index.js` | Manual / `serve.sh` | Scan kb/ to rebuild manifest.json + INDEX.md |

## Project Structure

```
ans-ai-auto-notes/
├── kb/                     # Knowledge base main directory
│   ├── 技术/AI/            # AI-related notes (LLMs, Applications, Coding, Claude-Code)
│   ├── 技术/Java/          # Java backend (MQ, Transactions, Hot-account, Spring AI)
│   ├── 技术/计算机基础/     # CS fundamentals (Statistics, Computation theory)
│   ├── 实战/               # Pitfall records & hands-on tips
│   └── 读书笔记/           # Reading notes
├── timeline/               # Weekly archived conversation summaries
├── memory/                 # AI memory layer (user profile, project knowledge, feedback)
├── scripts/                # Automation scripts
│   ├── vendor/             # Frontend dependencies (mermaid / marked / wordcloud2)
│   ├── app.js              # Overview page frontend logic
│   ├── lib.js              # Pure function library (Browser + Node dual-environment)
│   ├── build-index.js      # Index builder
│   └── ...                 # lint / session-log / audit, etc.
├── overview.html           # Visual overview page
├── server.js               # Local HTTP server (SSE live reload)
├── CLAUDE.md               # AI behavior rules (core config file)
└── timeline.json           # Timeline data
```

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (AI conversation-driven)

### 1. Clone the Project

```bash
git clone git@github.com:reallyhwc/ans-ai-auto-notes.git
cd ans-ai-auto-notes
```

### 2. Launch Knowledge Base Preview

```bash
./serve.sh
```

Starts a local HTTP server (port 8765, listening on `127.0.0.1` only) and auto-opens the browser. When Markdown files under `kb/` change, the browser live-reloads; new/deleted files trigger automatic index rebuild.

### 3. Start Chatting with Claude Code

```bash
claude
```

AI will automatically extract knowledge to the `kb/` directory based on rules in `CLAUDE.md`. Each file change is auto-committed, and the Stop hook runs health checks on exit and reminds about unpushed commits.

## Common Commands

```bash
./serve.sh                    # Launch local preview (port 8765)
node scripts/build-index.js   # Rebuild manifest.json + INDEX.md
./lint.sh                     # markdownlint format check
node scripts/check-overview.js # 12 health checks
bash scripts/arch-lint.sh     # 8 KB architecture checks
```

## Customization

Detailed rules, directory organization, file split thresholds, and note style rules are all in [CLAUDE.md](CLAUDE.md).

- **Modify personal background** → Edit "User Background" section in `CLAUDE.md`
- **Adjust knowledge base structure** → Modify directory rules and file split thresholds in `CLAUDE.md`
- **Customize note style** → Modify "Note Style Rules" section in `CLAUDE.md`
- **Add new categories** → Create new directories under `kb/`, AI will auto-detect and classify

## Tech Stack

| Component | Technology | Description |
|-----------|-----------|-------------|
| AI Engine | Claude Code + Superpowers | Conversation-driven + TDD/Debugging skill framework |
| Frontend Rendering | mermaid + marked + wordcloud2 | Diagrams/Markdown/Word cloud, all vendored locally |
| Server | Node.js (server.js) | Zero-dependency HTTP server + SSE live reload |
| Index Building | build-index.js | Scans kb/ to generate manifest.json |
| Quality Assurance | arch-lint + check-overview + markdownlint | Hook auto-execution, CI-level local checks |
| Data Storage | Git + Pure Markdown | Full version control, zero lock-in |

## License

[MIT](LICENSE) © xuhu
