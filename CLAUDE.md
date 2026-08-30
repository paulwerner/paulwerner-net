# CLAUDE.md — paulwerner.net Content Infrastructure

## Project Overview

This repository holds the content infrastructure for paulwerner.net: a branded landing page served at the root domain and a self-hosted Ghost blog at `blog.paulwerner.net`. Everything runs as Docker containers on a single VPS behind Caddy, which terminates TLS and routes by hostname.

## Tech Stack

- **Landing page**: Semantic HTML templated with EJS, styled with Tailwind CSS v4 compiled by the Tailwind CLI. Hand-written source lives in `src/`; `build.mjs` generates `site/`, which is committed and served
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
- **Zero third-party requests** — nothing served from `site/` or `ghost-theme/` may reference an external origin. No CDN, no font service, no analytics, no embeds. Fonts are self-hosted (woff2, OFL licences shipped alongside), and `npm run verify:no-third-party` enforces this. The privacy policy and the accessibility statement both depend on it staying true.
- **Static landing page** — no JavaScript framework. `build.mjs` renders EJS templates and compiles one stylesheet; the deployed output is HTML plus `assets/`.
- **`site/` is generated and committed** — the production server only runs `git pull` and Caddy serves `./site` via bind mount. Nothing compiles there. Any change under `src/` means running `npm run build` and committing the regenerated `site/` in the same change.
- **Accessibility is a shipped promise** — the site publishes a WCAG 2.1 AA conformance statement at `/accessibility/`. Changes to markup or palette must keep that true: run axe on all five pages and `npm run contrast` for colour changes.
- **Ghost best practices** — follow Ghost's official hosting recommendations (MySQL, not SQLite). Refer to https://ghost.org/docs/ for configuration and theming.

## Directory Structure

```
.
├── .env.example            # template for environment variables
├── .gitignore
├── build.mjs               # static build: EJS + Tailwind CLI -> site/
├── package.json            # build tooling only (Tailwind, EJS, @fontsource)
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
├── scripts/
│   ├── contrast-report.mjs # WCAG ratios computed from the shipped tokens
│   └── deploy-server.sh    # idempotent VPS provisioning
├── ghost-theme/            # custom Ghost theme (Handlebars + plain CSS)
│   ├── assets/
│   │   ├── css/            # theme.css (brand tokens, layout, prose) + prism.css
│   │   ├── fonts/          # self-hosted woff2 + OFL licences
│   │   └── js/             # bundled Prism (core + languages + toolbar plugins)
│   ├── partials/           # navigation, footer, post-card, pagination
│   ├── default.hbs         # base layout consumed by every template
│   ├── index.hbs
│   ├── post.hbs
│   ├── tag.hbs
│   ├── error-404.hbs
│   └── package.json
├── src/                    # hand-written source for the static site
│   ├── assets/             # images + TravelingTypewriter.otf (font source)
│   ├── data/pages.js       # page registry: footer nav, sitemap, titles
│   ├── layouts/base.ejs    # <head>, skip link, footer, shared scripts
│   ├── pages/*.ejs         # one per output page
│   ├── partials/           # footer, legal-header
│   ├── static/             # copied to the site root (robots.txt)
│   └── styles/             # tokens.css (@theme) + main.css (entry point)
└── site/                   # GENERATED — do not edit by hand; committed and served
    ├── assets/             # css/, fonts/ (woff2 + licences), images
    ├── accessibility/index.html
    ├── disclaimer/index.html
    ├── imprint/index.html
    ├── privacy/index.html
    ├── index.html
    ├── robots.txt
    └── sitemap.xml
```

## Build

```bash
npm install          # once
npm run build        # src/ -> site/
npm run dev          # rebuild on change
npm run contrast     # WCAG ratios for every brand token pair
npm run verify:no-third-party
```

The build renders each page in `src/data/pages.js`, compiles `src/styles/main.css`, copies assets and self-hosted fonts, writes `robots.txt` and `sitemap.xml`, and asserts that the Caddy `{{env ...}}` placeholders in the imprint survived templating. Brand tokens are defined once, in `src/styles/tokens.css`. See [docs/decisions/002-static-build-tailwind-v4-and-ejs.md](docs/decisions/002-static-build-tailwind-v4-and-ejs.md).

`site/imprint/index.html` is post-processed by Caddy's `templates` directive at request time — the `{{env "IMPRINT_STREET"}}` / `{{env "IMPRINT_CITY"}}` placeholders must survive any change to the build.

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
- The theme is a self-contained directory under `ghost-theme/`, bind-mounted into the Ghost container at `/var/lib/ghost/content/themes/paulwerner`. The mount is read-write because Ghost's entrypoint chowns everything under `content/` on boot; Ghost itself does not write to the theme tree. Edit files locally and either `docker compose restart ghost` (~5s) or re-activate the theme in admin to pick up `.hbs` and CSS/JS changes. One-time activation at `http://blog.localhost/ghost/#/settings/design` is still required after the first boot. A zip upload (packaged in `dist/paulwerner.zip` via the bash packaging snippet) is only needed to validate a packaged artifact for gscan.
- Refer to Ghost's theme documentation: https://ghost.org/docs/themes/
- Test themes using `ghost inspect` or by uploading to the running Ghost instance.
- Syntax highlighting uses a self-hosted Prism.js bundle (core + language packs + toolbar + copy-to-clipboard plugin) committed under `ghost-theme/assets/js/`. Prism tokens are re-colored to the brand palette in `ghost-theme/assets/css/prism.css`.
- Fonts are self-hosted under `ghost-theme/assets/fonts/` with their OFL licences: TravelingTypewriter, Source Serif 4 (400, 400 italic, 600, 700) and JetBrains Mono (400, 400 italic, 700 — `code`/`pre` and Prism's comment and bold tokens). The theme is not part of the `src/` build; it keeps its own `:root` token block, which duplicates the palette in `src/styles/tokens.css` by design.
- **Bump `version` in `ghost-theme/package.json` whenever theme assets change** — Ghost's `?v=` asset hash derives from it, not from file contents (learning 002).

## Brand & Design

See [docs/brand/brand-guidelines.md](docs/brand/brand-guidelines.md) for the full spec — color palette, typography, component patterns, and usage rules.

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
