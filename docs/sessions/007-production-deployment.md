# Session 007 — Production Deployment

## Goal

Prepare the repo for production: swap hardcoded localhost URLs for environment-aware production values, wire real social links, refresh the README, and ship a server provisioning script + deployment guide for the Hetzner VPS. Live deployment itself is performed by the user in a follow-up; this session covers everything that lives in the repo.

## What was built

### Code changes

- **`site/index.html`** — Ghost Content API config now switches on `window.location.hostname === 'localhost'`. Local dev keeps `http://blog.localhost` and the existing read-only Content key (`346785a9…`); production uses `https://blog.paulwerner.net` with a `REPLACE_WITH_PRODUCTION_API_KEY` placeholder pending the post-deploy Custom Integration step. The `posts-all-link` href and the API fetch URL inherit `GHOST.GHOST_URL` automatically — no further wiring needed.
- **`site/index.html`** — three footer social icons wired to real URLs: `https://github.com/paulwerner` (with `target="_blank" rel="noopener noreferrer"`), `https://blog.paulwerner.net`, `https://www.linkedin.com/in/paul-werner/` (with `target="_blank" rel="noopener noreferrer"`).
- **`ghost-theme/partials/footer.hbs`** — same three social URLs as the landing page; legal links switched from `http://localhost/...` to `https://paulwerner.net/imprint/`, `/privacy/`, `/disclaimer/`. Header comment updated to reflect production wiring.

### Docs and infrastructure artifacts

- **`README.md`** — full rewrite. Replaced the stale "Phase 1 skeleton" language with a concise overview: architecture (Caddy + Ghost + MySQL on Hetzner CAX11, Nuremberg), local dev quickstart, production URLs, and links to `CLAUDE.md`, `docs/decisions/001-hosting-using-hetzner.md`, and `docs/deployment.md`.
- **`scripts/deploy-server.sh`** — idempotent provisioning script for Ubuntu 24.04 ARM64. Sections: apt upgrade, unattended-upgrades, SSH password-auth hardening, UFW (22/80/443), Docker CE + Compose plugin via the official Ubuntu repo, 1 GB swapfile with fstab entry, repo clone into `/opt/paulwerner-net` (or `git pull` if present), `.env` seeded from `.env.example` with two `openssl rand -base64 24` suggestions printed for `MYSQL_ROOT_PASSWORD` / `MYSQL_PASSWORD`. `set -euo pipefail`; safe to re-run.
- **`docs/deployment.md`** — operator guide. Server details table (Hetzner CAX11, Nuremberg, IPv4, app dir), four-step initial deploy walkthrough (run script → edit `.env` with full key table → `docker compose up -d` + verify → Ghost first-run admin and Content API key handoff), update workflow snippet, and a "what to restart after `git pull`" matrix (`site/` → nothing, `Caddyfile` → restart caddy, `ghost-theme/` → restart ghost, `docker-compose.yml`/`.env` → `up -d`). Closes with a verification checklist.

## Key decisions

- **Environment-aware Ghost config via runtime hostname check** rather than build-time substitution or two separate files. Keeps the static-HTML deploy story (no build step) intact and lets the same `site/index.html` work locally and in production.
- **Production Content API key as a placeholder, not generated upfront.** Ghost only issues a key after first-run admin setup, so the order is: deploy → admin setup → create Custom Integration → commit the real key locally → `git pull` on server. The placeholder makes the missing piece explicit.
- **Ghost theme `navigation.hbs` left unchanged** — it already uses `{{@site.url}}`. The plan to add a "Home" link back to `paulwerner.net` is delegated to Ghost Admin → Settings → Navigation post-deploy, documented in `docs/deployment.md` step 4.
- **Theme footer legal links use absolute production URLs** rather than environment-aware logic. Handlebars templates render at request time on the server, where production URLs are always correct; the local dev story for the theme footer is acceptable to break since legal pages are owned by the landing site.
- **`scripts/deploy-server.sh` runs once on the VPS, not on every deploy.** Routine updates use the simpler `git pull` workflow documented in `docs/deployment.md` rather than re-running provisioning.

## Commits

1. `68ab2f1` — `docs: add session 007 plan`
2. `fed5b8c` — `feat(site): make Ghost config environment-aware`
3. `d373f1b` — `feat: wire social links and production legal URLs in footers`
4. `7ccbdff` — `docs: rewrite README for current project state`
5. `e0d7f4b` — `feat: add server provisioning script and deployment guide`

## Verification

Local checks (assistant ran):
- `grep -rn "http://localhost" site/ ghost-theme/` → no matches
- `grep -rn 'href="#"' site/ ghost-theme/` → no matches
- `git log --oneline` → five clean commits, no secrets beyond the public read-only Content API key already in source

User-tested locally and accepted. Live deployment verification (HTTPS certs, Ghost admin, posts feed) deferred to the follow-up session that performs the actual deploy.

## What's next

- Push to `origin/main` (not done in-session).
- Run `scripts/deploy-server.sh` on `178.105.43.46`, edit `.env`, `docker compose up -d`.
- Complete Ghost first-run admin setup, create the `Website` Custom Integration, swap the production Content API key into `site/index.html`, push, `git pull` on the server.
- Configure Ghost Navigation: add `Home` → `https://paulwerner.net/`.
- Deferred to later sessions: imprint address fill-in, off-box backups, SMTP provider for Ghost mail, analytics, SEO/OG meta, monitoring/uptime.
