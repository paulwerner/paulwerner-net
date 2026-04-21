# CLAUDE.md — paulwerner.net Content Infrastructure

## Project Overview

This project contains the content infrastructure for paulwerner.net: a branded landing page and a self-hosted Ghost blog at blog.paulwerner.net, deployed as Docker containers behind a reverse proxy with SSL.

## Tech Stack

- **Landing page**: Plain HTML + Tailwind CSS (no framework runtime, compiled via Tailwind CLI or Vite in vanilla mode)
- **Blog engine**: Ghost (official Docker image)
- **Database**: MySQL 8 (Ghost's recommended database)
- **Reverse proxy**: [TBD — Traefik or Caddy, decided in Phase 1]
- **SSL**: Let's Encrypt (automated via reverse proxy)
- **Container orchestration**: Docker Compose
- **Ghost theme**: Handlebars (Ghost's templating language)
- **DNS**: Managed at gandi.net

## Architecture

```
                        ┌─────────────────────────────┐
                        │       Reverse Proxy          │
                        │   (Traefik or Caddy + SSL)   │
                        └──────┬──────────────┬────────┘
                               │              │
              paulwerner.net   │              │  blog.paulwerner.net
                               │              │
                    ┌──────────▼──┐    ┌──────▼───────┐
                    │ Landing Page │    │    Ghost      │
                    │  (static)    │    │  (Node.js)   │
                    └─────────────┘    └──────┬───────┘
                                              │
                                       ┌──────▼───────┐
                                       │    MySQL      │
                                       └──────────────┘
```

All services run on a single VPS via Docker Compose. The reverse proxy terminates SSL and routes by hostname.

## Hosting

[TBD — decided in Phase 1. Candidates: Hetzner Cloud, OVHcloud, Hostinger VPS. EU data residency preferred.]

## Key Constraints

- **Cost-conscious** — this is a personal blog, not enterprise infrastructure. Prefer simple solutions over complex ones.
- **Docker-only deployment** — everything runs in containers. No software installed on the host besides Docker and Docker Compose.
- **Static landing page** — plain HTML + Tailwind CSS with no JavaScript framework. Tailwind is compiled at build time via the Tailwind CLI. The deployed output is a single HTML file, one CSS file, and assets. No JS runtime required.
- **Ghost best practices** — follow Ghost's official hosting recommendations (MySQL, not SQLite). Refer to https://ghost.org/docs/ for configuration and theming.

## Directory Structure

```
.
├── CLAUDE.md
├── docker-compose.yml
├── landing-page/
│   ├── index.html
│   ├── tailwind.config.js
│   ├── src/
│   │   └── input.css       # Tailwind directives
│   ├── dist/
│   │   └── output.css      # compiled Tailwind CSS
│   └── assets/              # images, fonts, favicon
├── ghost-theme/
│   ├── package.json
│   ├── index.hbs
│   ├── default.hbs
│   ├── post.hbs
│   ├── partials/
│   └── assets/
│       ├── css/
│       └── js/
├── config/
│   └── reverse-proxy/    # proxy config files
├── docs/
│   ├── plans/            # session plans (NNN-*.md)
│   ├── sessions/         # session summaries (NNN-*.md)
│   ├── learnings/        # brief records of discoveries (NNN-*.md)
│   └── brand/            # brand guidelines, color palette, typography
└── scripts/
    ├── deploy.sh          # deployment helpers
    └── backup.sh          # backup strategy
```

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
- **Historical docs are immutable:** Files in `docs/plans/`, `docs/sessions/`, and `docs/learnings/` are historical records — never modify them retroactively.
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

Reference `legacy_website.png` in the Project knowledge base for the visual direction of the legacy site. The new design evolves from this aesthetic: dark theme, warm amber/sepia tones, atmospheric industrial imagery, mixed monospace and serif typography.

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