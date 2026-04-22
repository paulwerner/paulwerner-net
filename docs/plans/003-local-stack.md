# Session 003 — Local Stack Finalization

## Context

Sessions 001–002 produced a skeleton three-service Docker Compose stack (Caddy + Ghost + MySQL), a skeleton `Caddyfile`, and a complete landing page under `site/`. Nothing has actually been brought up yet. This session makes the stack runnable end-to-end on the dev machine: `docker compose up` produces a landing page served locally and a Ghost instance reachable at a blog subdomain, with volumes persisting across restarts. No Hetzner work in this session — production deployment is deferred to a later phase after the Ghost theme lands.

A secondary goal is to bring `CLAUDE.md` back in sync with reality: Session 002 adopted the Tailwind Play CDN, but `CLAUDE.md` still describes a CLI build step that never shipped. Session 002's summary explicitly flagged this as owed reconciliation.

## Approach

Keep the Caddyfile production-identical. Push all local-vs-prod differences into `.env` — local dev sets `DOMAIN=http://localhost` and `BLOG_SUBDOMAIN=http://blog.localhost` (the `http://` scheme prefix makes Caddy serve plain HTTP, no TLS). Production will later set `DOMAIN=paulwerner.net` and Caddy auto-issues TLS. `*.localhost` resolves to 127.0.0.1 in all major browsers (RFC 6761) — no `/etc/hosts` edits needed.

## 1. Finalize `docker-compose.yml`

The skeleton is already structurally correct (three services, shared `web` bridge network, named volumes, Caddy is the only service publishing ports, Ghost waits on MySQL `service_healthy`). Changes:

- **Strip the three-line `# SKELETON — Phase 3 will finalize` header comment.**
- **Harden the MySQL healthcheck.** Current form `mysqladmin ping -h localhost -p${MYSQL_ROOT_PASSWORD}` emits a "password on command line" warning on every poll. Replace with a `CMD-SHELL` form that passes the password via the `MYSQL_PWD` env var:
  ```yaml
  test: ["CMD-SHELL", "MYSQL_PWD=\"$$MYSQL_ROOT_PASSWORD\" mysqladmin ping -h localhost -uroot --silent"]
  ```
  The `$$` escapes dollar expansion so Compose passes the literal `$MYSQL_ROOT_PASSWORD` for the shell to expand at runtime inside the container.
- **Leave everything else as-is.** The `depends_on` on Caddy, restart policies (`unless-stopped`), named volumes, Ghost env-var mapping, and the absence of `ports:` on Ghost/MySQL are already correct per the hosting decision doc.

Not doing in this session (can be added later if needed):
- A Ghost HTTP healthcheck — not required for local dev, and Ghost 5's alpine image doesn't ship `curl`/`wget` by default, so it would need a `node`-based check.
- Explicit resource limits — not needed locally.

## 2. Finalize `Caddyfile`

Strip the three-line skeleton header comment. Keep the two site blocks exactly as they are — `{$DOMAIN}` and `{$BLOG_SUBDOMAIN}` are already env-substituted at Caddy startup and will accept either a bare hostname (prod, triggers auto-HTTPS) or an `http://hostname` form (local, plain HTTP). No Caddyfile changes beyond the comment strip.

Reasoning: Caddy's site-block address accepts a URL scheme. `http://localhost { ... }` means "serve HTTP only on localhost:80". A bare `paulwerner.net { ... }` means "serve HTTPS on :443 (auto-issue cert) with a :80 → :443 redirect." Same file, environment controls scheme.

## 3. Create local `.env`

Copy `.env.example` to `.env` and populate with local-dev values. `.env` is already gitignored. Do not commit.

Values:

| Key | Local value | Rationale |
|---|---|---|
| `MYSQL_ROOT_PASSWORD` | `localdev-root` | Non-secret, container-internal only |
| `MYSQL_DATABASE` | `ghost` | Matches template |
| `MYSQL_USER` | `ghost` | Matches template |
| `MYSQL_PASSWORD` | `localdev-ghost` | Non-secret, container-internal only |
| `GHOST_DATABASE_HOST` | `mysql` | Service name on the bridge network |
| `GHOST_DATABASE_USER` | `ghost` | Matches `MYSQL_USER` |
| `GHOST_DATABASE_PASSWORD` | `localdev-ghost` | Matches `MYSQL_PASSWORD` |
| `GHOST_DATABASE_NAME` | `ghost` | Matches `MYSQL_DATABASE` |
| `GHOST_URL` | `http://blog.localhost` | URL Ghost advertises in admin/feeds locally |
| `GHOST_MAIL_TRANSPORT` | `Direct` | Built-in Nodemailer direct transport, no SMTP server needed for local dev |
| `GHOST_MAIL_HOST` | (leave placeholder) | Unused with `Direct` |
| `GHOST_MAIL_PORT` | `587` | Unused with `Direct` |
| `GHOST_MAIL_USER` | (leave placeholder) | Unused with `Direct` |
| `GHOST_MAIL_PASSWORD` | (leave placeholder) | Unused with `Direct` |
| `DOMAIN` | `http://localhost` | Caddy serves static landing page here |
| `BLOG_SUBDOMAIN` | `http://blog.localhost` | Caddy reverse-proxies to `ghost:2368` |

## 4. CLAUDE.md reconciliation

Three edits:

- **Tech Stack section** — replace stale Tailwind-CLI claim with CDN reality:
  - From: `**Landing page**: Plain HTML + Tailwind CSS (no framework runtime, compiled via the Tailwind CLI at build time)`
  - To: `**Landing page**: Plain HTML + Tailwind CSS loaded via the Tailwind Play CDN (no build step; a CLI build step can be introduced later if fidelity or offline use demands it)`

- **Key Constraints → Static landing page** — same replacement in the longer form:
  - From: `**Static landing page** — plain HTML + Tailwind CSS with no JavaScript framework. Tailwind is compiled at build time via the Tailwind CLI. The deployed output is a single HTML file, one CSS file, and assets. No JS runtime required.`
  - To: `**Static landing page** — plain HTML + Tailwind CSS with no JavaScript framework. Tailwind is loaded via the Tailwind Play CDN (`https://cdn.tailwindcss.com`) with an inline `tailwind.config` for brand tokens. The deployed output is a single HTML file plus the `assets/` directory. A CLI build step can be introduced later if fidelity, performance, or offline use becomes a concern.`

- **Brand & Design section** — replace the stale `[TBD — defined in Phase 2]` bullet with a reference to the now-existing guidelines:
  - From: `[TBD — defined in Phase 2. Brand guidelines will be added to docs/brand/.]`
  - To: `See [docs/brand/brand-guidelines.md](docs/brand/brand-guidelines.md) for the full spec — color palette, typography, component patterns, and usage rules.`
  - Leave the surrounding `legacy_reference.png` paragraph intact; it's still accurate.

**Phase ordering:** No phase-ordering text in CLAUDE.md contradicts the "Hetzner after Ghost theme" sequencing — there's no explicit phase ordering to update.

## 5. Verify

Run in order from the repo root:

1. `docker compose config` — validates the finalized YAML and env substitution.
2. `docker compose up -d` — brings up caddy, ghost, mysql. Ghost waits for MySQL healthy (~10–30s on first boot while MySQL initializes the data dir).
3. `docker compose ps` — all three should report `running`, mysql should be `healthy`.
4. Landing page: open `http://localhost/` in a browser. Should render `site/index.html` (the five-section landing page from Session 002) with the harbor background, amber-bordered hero card, etc. Confirm assets (avatar, background, font) load (no 404s in devtools Network tab).
5. Ghost admin: open `http://blog.localhost/ghost/` — should reach Ghost's first-run admin setup screen.
6. Persistence: `docker compose down && docker compose up -d`. Re-hit both URLs. Ghost's admin setup should remember state; MySQL's `ghost` DB should still exist.
7. Teardown for a clean state (optional, destructive): `docker compose down -v` to drop named volumes.

Known caveats to note during verification:
- If `blog.localhost` fails to resolve, the browser is using DNS instead of its built-in localhost shortcut — a one-line `/etc/hosts` workaround is `127.0.0.1 blog.localhost`.
- Ghost's first admin-panel load prints a harmless console warning about SMTP if `GHOST_MAIL_TRANSPORT=Direct` is used — expected.

## Critical files

| File | Action |
|---|---|
| `docker-compose.yml` | Edit: strip skeleton comment, harden MySQL healthcheck |
| `Caddyfile` | Edit: strip skeleton comment (no other changes) |
| `.env` | Create locally from `.env.example`, do not commit |
| `CLAUDE.md` | Edit: two tech-stack lines (Tailwind CDN) |
| `docs/plans/003-local-stack.md` | Create: copy this plan on approval |
| `docs/sessions/003-local-stack.md` | Create at session end after user acceptance |

## Commit plan (per CLAUDE.md: one commit per task, no batching)

1. `feat: finalize docker-compose for local stack`
2. `feat: finalize Caddyfile for local stack`
3. `docs: reconcile CLAUDE.md with current reality` (Tailwind CDN + Brand section)
4. `docs: add session 003 plan` (persisted from Claude Code plans dir)

`.env` is not committed (gitignored). Session summary is the last step, after user acceptance.
