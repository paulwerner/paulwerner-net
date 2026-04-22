# CLAUDE.md — paulwerner.net Content Infrastructure

## Project Overview

This repository holds the content infrastructure for paulwerner.net: a branded landing page served at the root domain and a self-hosted Ghost blog at `blog.paulwerner.net`. Everything runs as Docker containers on a single VPS behind Caddy, which terminates TLS and routes by hostname.

## Tech Stack

- **Landing page**: Plain HTML + Tailwind CSS (no framework runtime, compiled via the Tailwind CLI at build time)
- **Blog engine**: Ghost 5 (official `ghost:5-alpine` image)
- **Database**: MySQL 8 (Ghost's recommended database)
- **Reverse proxy**: Caddy 2 (automatic HTTPS via Let's Encrypt)
- **Container orchestration**: Docker Compose
- **Ghost theme**: Handlebars (Ghost's templating language)
- **DNS**: Managed at gandi.net

## Architecture

```
                        ┌─────────────────────────┐
                        │         Caddy            │
                        │  (TLS + static + proxy)  │
                        └──────┬──────────────┬────┘
                               │              │
              paulwerner.net   │              │  blog.paulwerner.net
                               │              │
                    ┌──────────▼──┐    ┌──────▼───────┐
                    │ Landing Page │    │    Ghost      │
                    │  (static)    │    │  (Node.js)    │
                    └─────────────┘    └──────┬───────┘
                                              │
                                       ┌──────▼───────┐
                                       │    MySQL      │
                                       └──────────────┘
```

All services run on a single VPS via Docker Compose on a shared bridge network. Caddy is the only service that publishes ports (80/443); Ghost and MySQL are reachable only inside the Compose network.

## Hosting

Hetzner Cloud CX23 in Nuremberg (NBG-1), Ubuntu 24.04 LTS. See [docs/decisions/001-hosting-using-hetzner.md](docs/decisions/001-hosting-using-hetzner.md) for the full decision (plan specs, cost, alternatives considered, firewall and backup strategy).

## Domain Mapping

- `paulwerner.net` → Caddy serves static files from `/srv/site` (bind-mounted from `./site/`).
- `blog.paulwerner.net` → Caddy `reverse_proxy` to `ghost:2368` on the shared Compose network.

## Key Constraints

- **Cost-conscious** — this is a personal blog, not enterprise infrastructure. Prefer simple solutions over complex ones.
- **Docker-only deployment** — everything runs in containers. No software installed on the host besides Docker and Docker Compose.
- **Static landing page** — plain HTML + Tailwind CSS with no JavaScript framework. Tailwind is compiled at build time via the Tailwind CLI. The deployed output is a single HTML file, one CSS file, and assets. No JS runtime required.
- **Ghost best practices** — follow Ghost's official hosting recommendations (MySQL, not SQLite). Refer to https://ghost.org/docs/ for configuration and theming.

## Directory Structure

```
.
├── .env.example            # template for environment variables
├── .gitignore
├── Caddyfile               # reverse-proxy config (Caddy 2)
├── CLAUDE.md
├── README.md
├── docker-compose.yml      # three-service stack: caddy, ghost, mysql
├── docs/
│   ├── brand/              # brand guidelines, reference imagery
│   ├── decisions/          # decision records (NNN-*.md)
│   ├── learnings/          # brief discovery notes (NNN-*.md)
│   ├── plans/              # session plans (NNN-*.md)
│   └── sessions/           # session summaries (NNN-*.md)
└── site/                   # static landing page files served by Caddy
    ├── assets/
    │   ├── avatar_small.png
    │   ├── background.png
    │   └── fonts/
    │       └── TravelingTypewriter.otf
    └── index.html
```

Additional directories will appear in later phases — in particular a `ghost-theme/` for the custom Handlebars theme and `scripts/` for deployment and backup helpers. They are not scaffolded until the session that first needs them.

## Environment Variables

Runtime configuration lives in `.env` at the repo root (gitignored). A committed template at `.env.example` documents every key and its role. The `.env` file must exist before `docker compose up` is run.

## Session Lifecycle

Each session follows this flow — do not skip or reorder steps:

1. **Plan** — Receive a session prompt. Investigate the codebase, ask clarifying questions, and produce a plan. The plan lives only in the Claude Code plans directory at this stage.
2. **Refine or approve** — Refine the plan or get approval.
3. **Persist plan** — After approval, copy the plan to `docs/plans/NNN-short-description.md`. Check existing files in `docs/plans/` for the next sequential index.
4. **Implement** — Execute the plan. Commit after each successfully completed step — do not batch multiple steps into a single commit.
5. **Review** — After implementation is complete, check in for review. Either improve together or the implementation is accepted.
6. **Finalize session** — Only after acceptance: write session summary. This is the last step — never do it before acceptance.

## Workflow Rules

- **Session summaries:** Written to `docs/sessions/NNN-short-description.md` covering what was built, key decisions, commits, and what's next. Only created after the implementation is accepted. Check existing files in `docs/sessions/` for the next index.
- **Decision records:** Significant technical decisions (hosting, tooling, architectural choices) are recorded in `docs/decisions/NNN-short-description.md`. Written at the time the decision is made; immutable afterwards.
- **Historical docs are immutable:** Files in `docs/plans/`, `docs/sessions/`, `docs/learnings/`, and `docs/decisions/` are historical records — never modify them retroactively.
- **Learnings:** When a session produces a significant learning (a wrong assumption corrected, a technical constraint discovered, a failed approach), document it in `docs/learnings/NNN-brief-summary.md`. Brief: 1–2 paragraphs covering what was assumed, what was discovered, what the correct approach is.
- **CLAUDE.md is a living document:** Update it at the end of any session where decisions are made that affect the tech stack, architecture, or workflow. It must always reflect the current state.

## Ghost Theme Development

- Ghost themes use the Handlebars templating engine — not React or any SPA framework.
- The theme is a self-contained directory that gets zipped and uploaded to Ghost.
- Refer to Ghost's theme documentation: https://ghost.org/docs/themes/
- Test themes using `ghost inspect` or by uploading to the running Ghost instance.
- Code block styling is critical — the blog serves technical content. Ensure syntax highlighting (via highlight.js or Prism.js) and a copy-to-clipboard button.

## Brand & Design

[TBD — defined in Phase 2. Brand guidelines will be added to `docs/brand/`.]

Reference `docs/brand/legacy_reference.png` for the visual direction of the legacy site. The new design evolves from this aesthetic: dark theme, warm amber/sepia tones, atmospheric industrial imagery, mixed monospace and serif typography.

## Code Style

- HTML: semantic markup, Tailwind CSS utility classes for styling, CSS custom properties for theme tokens (colors, fonts) that Tailwind references
- Handlebars: follow Ghost's conventions for template structure and partials
- Shell scripts: POSIX-compatible where possible, clear comments
- Docker Compose: use named volumes, explicit service dependencies, health checks
- Do not reference the project owner by name in code comments, docs, or configuration rationale

## Conventions

- Session prompts describe WHAT to build, not WHERE in the code. If a prompt references specific files, treat them as guidance — verify against the actual codebase before acting.
- When updating infrastructure (Docker Compose, proxy config), test locally before assuming it works. Document any port, volume, or network assumptions.
- When working on the Ghost theme, always test against real Ghost content (create test posts with code blocks, images, and long-form text).
