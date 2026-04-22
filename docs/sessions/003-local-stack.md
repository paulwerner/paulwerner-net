# Session 003 — Local Stack Finalization

## Outcome

The skeleton Docker Compose stack from Session 001 is now a working local development environment. `docker compose up -d` brings up Caddy + Ghost + MySQL, serves the Session 002 landing page at `http://localhost/`, and exposes Ghost's admin panel at `http://blog.localhost/ghost/`. Named volumes persist across restarts. No Hetzner work — production deployment is deferred to Phase 5, after the Ghost theme lands. CLAUDE.md is back in sync with reality: the stale "Tailwind via CLI at build time" claim is replaced with the CDN reality adopted in Session 002, and the Brand & Design section now points at the guidelines that actually exist.

## What was built

- [docs/plans/003-local-stack.md](../plans/003-local-stack.md) — plan persisted from the Claude Code plans directory
- [docker-compose.yml](../../docker-compose.yml) — skeleton header stripped; MySQL healthcheck hardened to pass the password via the `MYSQL_PWD` env var instead of embedding it on the command line (eliminates the per-poll "insecure password" warning)
- [Caddyfile](../../Caddyfile) — skeleton header stripped; site blocks otherwise unchanged. `{$DOMAIN}` and `{$BLOG_SUBDOMAIN}` accept either a bare hostname (production — auto-HTTPS) or an `http://hostname` form (local — plain HTTP), so the same file works in both environments
- `.env` — created locally from `.env.example` with local-dev values (gitignored, not committed). Uses `DOMAIN=http://localhost`, `BLOG_SUBDOMAIN=http://blog.localhost`, `GHOST_URL=http://blog.localhost`, `GHOST_MAIL_TRANSPORT=Direct` (no SMTP server needed), and non-secret MySQL passwords
- [CLAUDE.md](../../CLAUDE.md) — three edits:
  - Tech Stack: Tailwind is loaded via the Play CDN, not compiled via the CLI
  - Key Constraints → Static landing page: same correction in the longer form, with a note that a CLI step can be introduced later if needed
  - Brand & Design: stale `[TBD — defined in Phase 2]` placeholder replaced with a link to `docs/brand/brand-guidelines.md` (Session 002 added the file)

## Key decisions made during implementation

- **Local-vs-prod split lives entirely in `.env`.** Rather than forking the Caddyfile into local and production variants, the `http://` scheme prefix in `DOMAIN` / `BLOG_SUBDOMAIN` flips Caddy between plain HTTP (local) and auto-HTTPS (production). One Caddyfile, two environments.
- **`*.localhost` for the blog subdomain, no `/etc/hosts` edits.** RFC 6761 mandates that `*.localhost` resolves to 127.0.0.1; all major browsers honor this. Verification used `curl -H "Host: blog.localhost"` to avoid any ambiguity about browser-vs-DNS resolution.
- **MySQL healthcheck uses `MYSQL_PWD` via `CMD-SHELL`, not argv.** Original form was `mysqladmin ping -h localhost -p${MYSQL_ROOT_PASSWORD}`, which triggered a "password on command line" warning on every 10-second poll. Replaced with `CMD-SHELL` + `MYSQL_PWD="$$MYSQL_ROOT_PASSWORD" mysqladmin ping …`. The `$$` escapes Compose's variable expansion so the literal `$MYSQL_ROOT_PASSWORD` is written into the container; the in-container shell expands it at runtime.
- **Scope expansion for the Brand section.** The session prompt scoped CLAUDE.md edits to tech-stack + phase-ordering. The Brand & Design section's `[TBD — Phase 2]` line was out of that scope but factually stale (Session 002 already shipped `docs/brand/brand-guidelines.md`). Asked before acting; user chose to include the two-line reconciliation rather than defer it.
- **No phase-ordering edit needed.** The session prompt raised phase-ordering as a possible reconciliation given the "Hetzner after Ghost theme" deferral. CLAUDE.md has no explicit phase-ordering text — the only phase reference was the Brand TBD, already covered above.
- **`docker compose up` invoked via Bash during verification.** Docker Desktop wasn't running at session start; launched the exe directly (`"C:\Program Files\Docker\Docker\Docker Desktop.exe"`) rather than pausing to ask, since the prompt explicitly required verifying the stack comes up.
- **Verification via curl + byte-size match, not browser.** The landing-page HTML is unchanged from Session 002; session 003 only added the Caddy path. A 200 response with the expected 17838-byte body is sufficient evidence the bind mount and file_server work end-to-end. Flagged this at check-in so the user could do a visual pass if desired.
- **Persistence check via MySQL tables, not Ghost admin state.** Confirmed 75 Ghost tables survived a `docker compose down && docker compose up -d` cycle. Checking Ghost admin state would have needed first-run setup, which wasn't part of this session's scope.
- **Plan-commit-first ordering.** Per the session-lifecycle rule and the pattern set by Sessions 001/002, the plan was persisted to `docs/plans/` and committed before any implementation commits. Four commits total, one per logical task, no batching.

## Commits

```
5a1a560 docs: reconcile CLAUDE.md with current reality
97d6fca feat: finalize Caddyfile for local stack
287b90f feat: finalize docker-compose for local stack
9c87f78 docs: add session 003 plan
```

One commit per task per the session-lifecycle rule. No incidental owner commits landed mid-session this time.

## What's next

- **Phase 4 — Ghost theme.** Scaffold `ghost-theme/` with Handlebars templates that mirror the Session 002 brand language — the post-card styling, typography tokens, amber accents, and code-block treatment (syntax highlighting + copy-to-clipboard) are the open items. The running local stack is the development target: upload theme zips to `http://blog.localhost/ghost/` for live iteration.
- **Phase 5 — Operational polish + Hetzner deployment.** Scripts in `scripts/` for deploy and backup, monitoring, off-box backup destination, and the first real `docker compose up` on the Hetzner VPS. Production `.env` lives only on the VPS; DNS (A record for `paulwerner.net`, CNAME for `blog`) cuts over at this step. Caddy's automatic HTTPS takes over from local plain-HTTP with no Caddyfile change.

### Local-stack follow-ups (defer until needed)

- **Ghost HTTP healthcheck.** Not added this session — Ghost 5's alpine image doesn't ship `curl`/`wget` consistently, so a healthcheck would need a `node`-based probe. Worth adding before production so Caddy doesn't forward to a Ghost that hasn't finished boot.
- **Resource limits.** No memory/CPU caps on any service. Worth revisiting on the CX23 VPS (4 GB RAM shared across all three services).
- **Mail transport.** Local dev uses `GHOST_MAIL_TRANSPORT=Direct`. Production needs a real SMTP provider before Ghost admin flows (password reset, member magic links, newsletters) work — a Phase 5 decision.
