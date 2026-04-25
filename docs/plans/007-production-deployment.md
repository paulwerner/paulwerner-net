# Session 007 — Production Deployment

## Context

Sessions 001–006 produced a working local stack (Caddy + Ghost + MySQL via Docker Compose) with a branded landing page, custom Ghost theme, legal pages, and recent polish. Hetzner CAX11 is provisioned at `178.105.43.46` (Ubuntu 24.04 ARM64, key-based SSH). This session ships it: swap hardcoded localhost URLs for environment-aware production values, wire real social links, refresh the README, and produce a deployment script + guide the user runs on the VPS.

## Findings from exploration

- `site/index.html` — Ghost config at lines 224–227 is hardcoded to `http://blog.localhost`. Local content key already in source: `346785a9454fb64a5cd04861b2`. Legal-link footer (lines 161–163) uses root-relative paths (`/imprint/`, etc.) — already environment-agnostic, no change needed. Social icons (lines 167–184) all `href="#"`. `data-year` script already dynamic. `posts-all-link` is set via `allLink.href = GHOST.GHOST_URL` (line 234) — will follow the new env-aware value automatically.
- `ghost-theme/partials/footer.hbs` — legal links hardcoded to `http://localhost/...` (lines 5–7); three social icons all `href="#"`.
- `ghost-theme/partials/navigation.hbs` — Home link uses `{{@site.url}}` (Ghost-managed). No hardcoded localhost. Confirmed reverted in Session 006. Strategy: leave as-is; rely on Ghost Admin → Settings → Navigation to add a "Home" entry pointing to `https://paulwerner.net/` post-deploy.
- `README.md` — still describes "Phase 1 skeleton"; needs rewrite.
- `scripts/` — does not exist yet; will be created.

## Plan

### Part 1 — Local repo changes

**1a. `site/index.html`** — replace lines 220–227 with env-aware Ghost config:
```js
// Ghost Content API keys are read-only and public by design — safe to commit.
const isLocal = window.location.hostname === 'localhost';
const GHOST = {
  GHOST_URL: isLocal ? 'http://blog.localhost' : 'https://blog.paulwerner.net',
  CONTENT_API_KEY: isLocal
    ? '346785a9454fb64a5cd04861b2'
    : 'REPLACE_WITH_PRODUCTION_API_KEY',
};
```
The `posts-all-link` already follows `GHOST.GHOST_URL` — no further change.

**1b. `site/index.html`** — wire footer social hrefs:
- GitHub → `https://github.com/paulwerner`
- Blog → `https://blog.paulwerner.net`
- LinkedIn → `https://www.linkedin.com/in/paul-werner/`

Add `target="_blank"` + `rel="noopener noreferrer"` for GitHub and LinkedIn (external); blog stays same-origin.

**1c. `ghost-theme/partials/footer.hbs`** — swap legal links to absolute production URLs (`https://paulwerner.net/imprint/`, `/privacy/`, `/disclaimer/`); apply same social-href updates as 1b. Update header comment.

**1d. `README.md`** — concise rewrite (~30 lines):
- One-line description
- Architecture paragraph (Caddy + Ghost + MySQL on Hetzner CAX11, Nuremberg)
- Local development snippet (`cp .env.example .env`, `docker compose up -d`, URLs)
- Production URLs
- Links to `CLAUDE.md`, `docs/decisions/001-hosting-using-hetzner.md`, `docs/deployment.md`

### Part 2 — Server provisioning artifacts

**2a. `scripts/deploy-server.sh`** — idempotent provisioning script the user copies to the server and runs as root. Sections:
1. `apt update && apt upgrade -y`
2. Install + configure `unattended-upgrades` non-interactively
3. Harden SSH: ensure `PasswordAuthentication no`, restart sshd
4. UFW: deny incoming, allow 22/80/443, enable
5. Install Docker CE + Compose plugin via official Ubuntu repo (ARM-aware via `dpkg --print-architecture`)
6. Create `/swapfile` (1 GB), enable, persist in `/etc/fstab`
7. Clone `https://github.com/paulwerner/paulwerner-net.git` into `/opt/paulwerner-net` if missing; otherwise `git pull`
8. `cp -n .env.example .env` (only if not present); print openssl-generated suggestions for `MYSQL_ROOT_PASSWORD` / `MYSQL_PASSWORD`
9. Print next steps (edit `.env`, then `docker compose up -d`)

Each step guarded by an idempotency check (file existence, package status, ufw rule presence) so re-running is safe. Uses `set -euo pipefail`.

**2b. `docs/deployment.md`** — step-by-step user guide:
1. SSH into the box, copy/run `deploy-server.sh`
2. Edit `/opt/paulwerner-net/.env` (table of keys with prod values; refer to plan input for full table)
3. `docker compose up -d`, wait for MySQL health, verify with `docker compose ps` and `docker compose logs caddy`
4. First-run Ghost admin setup at `https://blog.paulwerner.net/ghost/`
5. Create "Website" Custom Integration → copy Content API key → update `site/index.html` locally → commit → push → `git pull` on server
6. Ghost Admin → Settings → Navigation → add Home entry pointing to `https://paulwerner.net/`
7. Update workflow snippet (edit local → commit → push → `git pull` on server; restart only if `docker-compose.yml` or `ghost-theme/` changed)
8. Verification checklist (curl probes, browser checks)

### Commit sequence

Per CLAUDE.md (one logical unit per commit):
1. `docs: add session 007 plan` (after approval, copy plan to `docs/plans/007-production-deployment.md`)
2. `feat(site): make Ghost config environment-aware`
3. `feat: wire social icon links in both footers`
4. `docs: rewrite README for current project state`
5. `feat: add server provisioning script and deployment guide`
6. Review checkpoint
7. `docs: add session 007 summary` (after acceptance only)

## Critical files

- `site/index.html` (lines 167–184 social, 220–227 Ghost config)
- `ghost-theme/partials/footer.hbs` (legal + social)
- `README.md` (full rewrite)
- `scripts/deploy-server.sh` (new)
- `docs/deployment.md` (new)
- `docs/plans/007-production-deployment.md` (new, after approval)

## Out of scope (deferred)

- Imprint address fill-in
- Analytics, SEO/OG meta
- Off-box backups, SMTP provider, monitoring

## Verification

Local (assistant performs):
- `git diff` — no secrets beyond the public read-only Content API key already in repo
- `grep -rn "http://localhost" site/ ghost-theme/` — no matches outside explanatory comments
- `grep -n 'href="#"' site/index.html ghost-theme/partials/footer.hbs` — no matches

Server (user performs, per `docs/deployment.md`):
- `docker compose ps` → all three services running, mysql healthy
- `curl -I https://paulwerner.net` → 200, `server: Caddy`
- `curl -I https://blog.paulwerner.net` → 200
- Browser: landing page, blog index, `/ghost/` admin, three legal pages all load over valid HTTPS
- Footer social icons resolve to real GitHub / blog / LinkedIn URLs
- After API key swap + `git pull`: posts section populates (or stays hidden if empty)
