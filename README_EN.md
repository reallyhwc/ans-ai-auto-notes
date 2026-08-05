[中文](README.md) | **English**

# AI Auto Notes — Conversation-Driven Personal Knowledge Base

> Chat with AI, automatically distill into a structured knowledge base. Zero manual organizing, fully local, 76 notes and growing.

[:books: Browse Knowledge Base →](INDEX.md) &nbsp;|&nbsp; [:bar_chart: Visual Overview](http://localhost:8765/overview.html)

## What Is This?

Every time you chat with Claude Code, the AI automatically classifies, summarizes, and organizes the content into a structured Markdown knowledge base. You just chat naturally—ask questions, discuss, learn—and the knowledge base grows in the background.

**Core Philosophy: You're not taking notes—AI is taking them for you.**

## 🚀 Want to Build Your Own Knowledge Base?

The `main` branch is the author's personal knowledge base (76 notes). If you want to **build your own using the same architecture**, use the [`quickStart` branch](https://github.com/reallyhwc/ans-ai-auto-notes/tree/quickStart):

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
- **Proactive Capture**: AI directly writes technical content to kb/ without ever asking "should I save this?"
- **Three-Layer Constraint System**: Based on Harness Engineering principles, rules aren't just written in CLAUDE.md—they're mechanically enforced via hooks
- **Visual Overview**: One-click local preview with category browsing, timeline, full-text search, word cloud, and Mermaid diagram rendering
- **Zero Network Dependency**: All frontend resources (mermaid / marked / wordcloud2) are vendored locally, instant offline access
- **Fully Local**: All data stored in a local Git repository—you have 100% control

## Knowledge Base Overview

Currently accumulated **76** structured notes covering the following areas:

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
| **Constraint** | SessionStart | Environment health check + stale changes reminder + memory expiry check (>14 days) + Architecture Linter (15 checks: frontmatter / dead links / duplicate titles / line count / case / section numbering / anchor liveness, etc.) |
| **Constraint** | Stop | Markdown lint + Git status + Health check (12 items) + Session log + Permission audit + Unpushed reminder (≥3 auto push) + Claim audit + Content quality fast-path |
| **Documentation** | Stop → File | Auto-generate structured session log from git diff, appending for same-day multiple sessions |
| **Documentation** | Cross-Session | Memory layered (stable/project/stream), all memories timestamped, >14 days auto-alert |

### Hook Script System

| Script | Trigger | Function |
|--------|---------|----------|
| `scripts/preflight.sh` | SessionStart | Last session summary, stale changes, manifest expiry, memory eviction, invoke arch-lint |
| `scripts/arch-lint.sh` | SessionStart | 15 KB architecture checks (frontmatter / dead links / duplicate titles / line count / case / memory format / zero deps / script refs / heading ID contract / section numbering / anchor liveness / content concreteness, etc.) |
| `exit-check.sh` | Stop | Chain 11 exit checks: lint + check-overview + session-log + permission-audit + list-open-plans + check-agent-log-compliance + content-quality-fast + unpushed (≥3 auto push) |
| `scripts/verify-claim.sh` | PostToolUse | Verify files claimed "saved to xxx.md" actually exist, write claim-ledger (consumed by exit-check) |
| `scripts/pretool-guard.sh` | PreToolUse | Block direct edits to INDEX.md / manifest.json / overview.html (exit 2) |
| `scripts/hook-logger.sh` | All shell hooks | Transparent wrapper, logs hook duration/exit code to `logs/hook-runs.jsonl` |
| `scripts/agent-log-hook.js` | Stop / SubagentStop | Main agent + subagent work log (auto-derive title/summary/outcome) |
| `scripts/session-log.sh` | Stop | Auto-generate session log from git diff |
| `scripts/permission-audit.sh` | Stop | Scan scripts/ vs allowlist, suggest safe commands for whitelisting |
| `scripts/check-overview.js` | Stop | 12 health checks (data integrity, links, line count, etc.) |
| `scripts/content-quality-fast.sh` | Stop | Lightweight content quality (cross-links / concrete elements / metadata date expiry) |
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
bash scripts/arch-lint.sh     # 15 KB architecture checks
```

## Skill System (AI Capability Packs)

The project adopts **progressive skill disclosure** — domain knowledge is packaged as semantically-triggerable capability units loaded on demand. See [Skills 渐进式披露架构](kb/技术/AI/Claude-Code/Skills%20渐进式披露架构.md).

### The 5 Skills

| Skill | Type | Trigger | Role |
|-------|------|---------|------|
| **kb-content-style** | Reference | Claude auto-triggers | Enforces Mermaid-first, continuous section numbering, Chinese filename = title when writing kb/ notes (authoritative rules; details in reference.md) |
| **kb-tdd-discipline** | Discipline | Claude auto-triggers | Enforces red-green-refactor + bug-reproduction tests when modifying scripts/tests |
| **auto-commit-discipline** | Discipline | Claude auto-triggers | Commits immediately after each batch of changes; auto-pushes ≥3 unpushed commits |
| **arch-lint-fix-guide** | Reference | Claude auto-triggers | Fix guide for the 15 arch-lint.sh checks |
| **build-index** | Task | Claude auto-trigger / `/build-index` | Rebuilds manifest.json + INDEX.md after adding/removing kb files |

### Skill Development Discipline (SDD)

Skill development follows **SDD (Skill Development Discipline)** — applying TDD to the documentation domain:

1. **RED**: Run pressure scenarios with a subagent to observe baseline behavior without the skill
2. **GREEN**: Write the minimal skill solving the observed problem
3. **REFACTOR**: Plug new loopholes, refine the Rationalization Table

See the "Skill 开发纪律" section in [CLAUDE.md](CLAUDE.md) and superpowers `writing-skills` skill.

## Subagent System (AI Collaboration Team)

The project registers 3 project-level subagents (defined in `.claude/agents/`), complementary to skills:

| Subagent | Role | Trigger | Output |
|----------|------|---------|--------|
| **kb-auditor** | Reviews depth/sections/links/visualization of long-form kb notes | Spawned after ≥300 new lines or a single file ≥800 lines (loads kb-content-style audit standards itself) | `logs/audits/*.md` + structured VERDICT |
| **idea-extractor** | Identifies KB candidates from long text/URLs (no writes) | Spawned when user pastes long articles/URLs | Structured EXTRACT-VERDICT + candidates |
| **plan-executor** | Runs all tasks in a plan file end-to-end | User says "run plan X" | `logs/plan-runs/*.md` + VERDICT |

**Relationship with skills**: Skills provide "how to write" standards (reference) and "what action to run" shortcuts (task); subagents handle long tasks that need independent execution — the three coexist complementarily.

See [`.claude/agents/README.md`](.claude/agents/README.md) and [Subagent 机制与实战](kb/技术/AI/Claude-Code/子智能体（subagents）机制与实战.md).

## Customization

Core discipline lives in [CLAUDE.md](CLAUDE.md); the detailed rules for file organization, note style, and split thresholds are **consolidated into the [kb-content-style skill](.claude/skills/kb-content-style/SKILL.md)** (details in reference.md).

- **Modify personal background** → Edit "User Background" section in `CLAUDE.md`
- **Adjust KB structure / split thresholds** → Modify the split rules in `.claude/skills/kb-content-style/`
- **Customize note style** → Modify the note-style rules in `.claude/skills/kb-content-style/`
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
