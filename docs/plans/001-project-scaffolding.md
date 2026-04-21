# Session 001 — Project Scaffolding

## Context

This is the first implementation session for paulwerner.net. The repo currently holds only `CLAUDE.md`, `README.md` (83-byte stub), an empty `.gitignore`, the hosting decision record at [docs/decisions/001-hosting-using-hetzner.md](../decisions/001-hosting-using-hetzner.md), and `docs/brand/legacy_reference.png`. An untracked `install.cmd` (a Claude Code Windows bootstrap script) sits at the repo root.

The Hetzner + Caddy + Ghost + MySQL stack decision is finalised. This session lays down the structural scaffolding — skeleton Docker/Caddy configs, environment template, directory tree, and updated project docs — so Phase 2 (brand/design) and Phase 3 (real config) can proceed without debating layout. Nothing in this session needs to run.

## Key observations from exploration

- **CLAUDE.md already exists and is comprehensive** but still says `[TBD]` for reverse proxy and hosting, and its "Directory Structure" section references `landing-page/`, `config/reverse-proxy/`, `ghost-theme/`, `scripts/` — none of which the session prompt asks us to create now, and the prompt uses `site/` instead of `landing-page/`. The existing file needs a rewrite to match the session prompt's target structure and to resolve the TBDs.
- **README.md** is 83 bytes and needs full replacement.
- **`.gitignore`** is empty.
- **`install.cmd`** is untracked; it's a local Claude Code installer, not project content. **Decision: delete it.**
- **Directories missing:** `docs/plans/`, `docs/sessions/`, `docs/learnings/`, `site/`.
- **Files missing:** `docker-compose.yml`, `Caddyfile`, `.env.example`, `site/index.html`.

## Naming reconciliation

The hosting decision doc refers to the landing-page bind mount as `./landing-page/`. The Session 001 prompt uses `site/`. The prompt is explicit and newer → **use `site/`** and update CLAUDE.md accordingly. The decision doc is immutable historical record — no change there.

## Final directory layout after this session

```
.
├── .env.example
├── .gitignore
├── Caddyfile
├── CLAUDE.md
├── README.md
├── docker-compose.yml
├── docs/
│   ├── brand/
│   │   └── legacy_reference.png
│   ├── decisions/
│   │   └── 001-hosting-using-hetzner.md
│   ├── learnings/
│   │   └── .gitkeep
│   ├── plans/
│   │   ├── .gitkeep
│   │   └── 001-project-scaffolding.md
│   └── sessions/
│       ├── .gitkeep
│       └── 001-project-scaffolding.md   (added at session close)
└── site/
    └── index.html
```

## Implementation plan

Per CLAUDE.md workflow rules: **one commit per task**, no batching. Eleven commits total.

### Step 1 — Persist plan
Copy this plan to [docs/plans/001-project-scaffolding.md](001-project-scaffolding.md). Create `docs/plans/` if it does not exist (no `.gitkeep` needed since the plan file itself will track the directory — but include `.gitkeep` for consistency with deliverable spec).
Commit: `docs: add session 001 plan`.

### Step 2 — Delete `install.cmd` and populate `.gitignore`
- Delete `install.cmd` from the repo root (local Claude Code installer, not project content).
- Populate `.gitignore` with: `.env`, `.env.*` (except `.env.example`), `node_modules/`, `npm-debug.log*`, `yarn-debug.log*`, `yarn-error.log*`, build outputs (`dist/`, `landing-page/dist/`, `ghost-theme/assets/built/`), OS files (`.DS_Store`, `Thumbs.db`, `desktop.ini`), editor configs (`.vscode/`, `.idea/`, `*.swp`), Docker artifacts (`docker-compose.override.yml`), Ghost local-dev uploads (`ghost_content/`).

Commit: `chore: populate .gitignore and drop local installer`.

### Step 3 — `.env.example`
Keys per session prompt, each with a short inline comment. No real secrets. Grouped as: MySQL, Ghost DB, Ghost mail, Ghost URL, Caddy domains.
Commit: `chore: add .env.example template`.

### Step 4 — Scaffold docs directories
Create `docs/plans/.gitkeep`, `docs/sessions/.gitkeep`, `docs/learnings/.gitkeep`. (`docs/plans/.gitkeep` is added alongside the plan in Step 1 so this step only handles `sessions/` and `learnings/`.)
Commit: `chore: scaffold docs/sessions and docs/learnings`.

### Step 5 — `docker-compose.yml` skeleton
- Services: `caddy` (`caddy:2-alpine`, ports `80:80` + `443:443`), `ghost` (`ghost:5-alpine`, no published port, `depends_on: mysql` with `condition: service_healthy`), `mysql` (`mysql:8`, no published port).
- Env refs: `${MYSQL_ROOT_PASSWORD}`, `${MYSQL_DATABASE}`, `${MYSQL_USER}`, `${MYSQL_PASSWORD}`, `${GHOST_URL}`, Ghost DB env (`database__client`, `database__connection__*`), mail env, `${DOMAIN}`, `${BLOG_SUBDOMAIN}`.
- Named volumes: `ghost_content`, `mysql_data`, `caddy_data`, `caddy_config`.
- Bind mounts: `./Caddyfile:/etc/caddy/Caddyfile:ro`, `./site:/srv/site:ro`.
- Shared network `web`.
- Basic healthcheck on MySQL (`mysqladmin ping`) to satisfy CLAUDE.md code style rule.
- Header comment: `# SKELETON — Phase 3 will finalize.`
Commit: `feat: add docker-compose skeleton`.

### Step 6 — `Caddyfile` skeleton
```
{$DOMAIN} {
    root * /srv/site
    encode gzip
    file_server
}

{$BLOG_SUBDOMAIN} {
    encode gzip
    reverse_proxy ghost:2368
}
```
Header comment noting skeleton status.
Commit: `feat: add Caddyfile skeleton`.

### Step 7 — `site/index.html`
Minimal valid HTML5 document, `<title>` = "paulwerner.net", `<h1>` with site name, short `<p>` noting this is a placeholder until Phase 2/3. No styling. Semantic markup per CLAUDE.md code style.
Commit: `feat: add landing page placeholder`.

### Step 8 — Rewrite CLAUDE.md
Preserve workflow and code-style sections; update:
- **Tech Stack:** fill in reverse proxy as Caddy (automatic HTTPS).
- **Hosting:** replace `[TBD]` with "Hetzner Cloud CX23 in Nuremberg (NBG-1). See [docs/decisions/001-hosting-using-hetzner.md](docs/decisions/001-hosting-using-hetzner.md)."
- **Architecture diagram:** swap "Traefik or Caddy" → "Caddy".
- **Directory Structure:** replace speculative tree with the actual post-Session-001 tree only (CLAUDE.md, README.md, .env.example, .gitignore, Caddyfile, docker-compose.yml, docs/, site/). Do not list future directories in the tree. A short sentence below the tree notes that `ghost-theme/` and similar will be added in later phases, but the tree itself stays truthful to reality.
- **Add "Domain Mapping" subsection:** `paulwerner.net` → Caddy static from `/srv/site`; `blog.paulwerner.net` → Caddy reverse_proxy to `ghost:2368`.
- **Add "Decisions" to Workflow Rules:** decision records live in `docs/decisions/NNN-*.md`, immutable like plans/sessions/learnings.
- **Add `.env` note:** env vars live in `.env` (gitignored), template at `.env.example`.
- **Keep** Session Lifecycle, Workflow Rules, Ghost Theme Development, Brand & Design, Code Style, Conventions sections.

Commit: `docs: update CLAUDE.md for Phase 1 decisions`.

### Step 9 — Rewrite README.md
Project name, one-line description, short architecture paragraph, local-run note (`docker compose up` target, `.env` required, placeholder since stack is skeleton), link to decision record, Phase 2 brand note. Under ~30 lines.
Commit: `docs: expand README`.

### Step 10 — Review checkpoint
Per CLAUDE.md step 5 of session lifecycle: pause for user review. No commit.

### Step 11 — Session summary
Only after user acceptance: write [docs/sessions/001-project-scaffolding.md](../sessions/001-project-scaffolding.md) covering what was built, key decisions (Caddy confirmed in CLAUDE.md, `site/` chosen over `landing-page/`, `install.cmd` deleted), commits made, and what's next (Phase 2: brand guidelines in `docs/brand/`).
Commit: `docs: add session 001 summary`.

## Critical files

- [CLAUDE.md](../../CLAUDE.md) — rewrite (preserve workflow sections, resolve TBDs, update directory tree)
- [README.md](../../README.md) — rewrite
- `.gitignore` — populate from empty
- `.env.example` — create
- `docker-compose.yml` — create skeleton
- `Caddyfile` — create skeleton
- `site/index.html` — create placeholder
- `docs/plans/.gitkeep`, `docs/sessions/.gitkeep`, `docs/learnings/.gitkeep` — create
- [docs/decisions/001-hosting-using-hetzner.md](../decisions/001-hosting-using-hetzner.md) — read-only reference, do not modify

## Verification

Structural session — nothing executes. Verification is visual/static:

1. `git status` — confirm final tree matches the Deliverables section of the session prompt.
2. `docker compose config` — lint the skeleton compose file (should parse; env vars unresolved is fine if `.env` not present).
3. Load `Caddyfile` mentally or via `caddy validate --adapter caddyfile` if Caddy is available locally — should parse.
4. Open `site/index.html` in a browser — renders a readable placeholder.
5. Confirm `install.cmd` no longer exists on disk and does not appear in `git status`.
6. Confirm CLAUDE.md "Directory Structure" section matches the actual tree on disk.

Phase 3 will be the first session where the stack is actually brought up.
