# Deployment

How to provision the production VPS and deploy paulwerner.net for the first time, plus the ongoing update workflow.

## Server

| Detail | Value |
|--------|-------|
| Provider | Hetzner Cloud |
| Plan | CAX11 (ARM/Ampere, 2 vCPU, 4 GB RAM) |
| Location | Nuremberg (NBG-1) |
| OS | Ubuntu 24.04 LTS (aarch64) |
| Public IPv4 | `178.105.43.46` |
| App directory | `/opt/paulwerner-net` |

DNS (managed at gandi.net): `paulwerner.net` and `blog.paulwerner.net` both point to the IPv4 above.

## Initial deployment

### 1. Run the provisioning script

From your local machine:

```bash
scp -i ~/.ssh/hetzner_paulwerner scripts/deploy-server.sh root@178.105.43.46:/root/
ssh -i ~/.ssh/hetzner_paulwerner root@178.105.43.46 'bash /root/deploy-server.sh'
```

The script is idempotent — safe to re-run. It updates packages, enables unattended security upgrades (with an automatic reboot at 04:00 server time when an update requires one), disables SSH password auth, configures UFW (22/80/443), installs Docker + Compose, creates a 1 GB swapfile, clones the repo into `/opt/paulwerner-net`, and seeds a `.env` from `.env.example`.

### 2. Configure `.env`

SSH in and edit `/opt/paulwerner-net/.env`. The script printed two suggested random passwords; use those or generate your own with `openssl rand -base64 24`.

| Key | Production value |
|-----|------------------|
| `MYSQL_ROOT_PASSWORD` | strong random |
| `MYSQL_DATABASE` | `ghost` |
| `MYSQL_USER` | `ghost` |
| `MYSQL_PASSWORD` | strong random (different from root) |
| `GHOST_DATABASE_HOST` | `mysql` |
| `GHOST_DATABASE_USER` | `ghost` |
| `GHOST_DATABASE_PASSWORD` | same as `MYSQL_PASSWORD` |
| `GHOST_DATABASE_NAME` | `ghost` |
| `GHOST_URL` | `https://blog.paulwerner.net` |
| `GHOST_MAIL_TRANSPORT` | `Direct` (swap to SMTP later) |
| `GHOST_MAIL_HOST` | placeholder |
| `GHOST_MAIL_PORT` | `587` |
| `GHOST_MAIL_USER` | placeholder |
| `GHOST_MAIL_PASSWORD` | placeholder |
| `DOMAIN` | `paulwerner.net` |
| `BLOG_SUBDOMAIN` | `blog.paulwerner.net` |

### 3. Start the stack

```bash
cd /opt/paulwerner-net
docker compose up -d
```

First boot takes 30–60 seconds while MySQL initializes. Verify:

```bash
docker compose ps                # all three services running, mysql healthy
docker compose logs caddy        # certificate obtained for both domains
curl -I https://paulwerner.net   # 200, server: Caddy
curl -I https://blog.paulwerner.net
```

### 4. Ghost first-run setup

1. Visit <https://blog.paulwerner.net/ghost/> and complete the admin owner setup (name, email, password).
2. **Settings → Design → Change theme** → activate the `paulwerner` theme (it's already available via the bind mount).
3. **Settings → Integrations → Add Custom Integration** → name it `Website`. Copy the Content API key.
4. **Locally**, edit `site/index.html` and replace `REPLACE_WITH_PRODUCTION_API_KEY` with the copied key. Commit and push:
```bash
   git commit -am "feat(site): add production Ghost Content API key"
   git push
```
5. On the server: `cd /opt/paulwerner-net && git pull` — Caddy serves `site/` from the bind mount, no restart needed.
6. **Settings → Navigation** → ensure a `Home` entry points to `https://paulwerner.net/` so blog visitors can return to the main site.

### 5. Privacy-relevant Ghost settings

The privacy policy at `/privacy/` describes the blog as setting no cookies, storing nothing in the browser and sending nothing to third parties. The theme enforces part of that (`{{ghost_head exclude="search,portal,comment_counts"}}` keeps Ghost's jsDelivr-hosted scripts off the page). The rest depends on settings stored in Ghost's database, which the repo cannot set. In Ghost Admin → Settings, check after first-run setup and after major upgrades:

| Setting (internal key) | Required value | Why |
|---|---|---|
| Analytics → Member sources (`members_track_sources`) | Off | When on, Ghost loads `member-attribution.min.js`, which writes the visitor's page history to `sessionStorage` (`ghost-history`) on every page |
| Analytics → Web analytics (`web_analytics`) | Off | Sends page-view data to an analytics backend when one is configured |
| Membership → Access (`members_signup_access`) | Nobody, unless a newsletter is launched | No sign-up UI exists in the theme; the privacy policy has to be extended before one is added |
| Growth → Network / social web (`social_web`) | Off, unless deliberately used | Publishes posts through Ghost's hosted ActivityPub service, a third party |

To check the result from a browser: open a blog post, then DevTools → Network (no request should leave `blog.paulwerner.net`) and Application → Storage (cookies, local storage and session storage all empty).

## Update workflow

The standard loop: edit locally → commit → push → `git pull` on the server. The only file that lives exclusively on the server is `.env`.

```bash
ssh -i ~/.ssh/hetzner_paulwerner root@178.105.43.46
cd /opt/paulwerner-net
git pull
```

What to do after `git pull`, depending on what changed:

| Changed | Action |
|---------|--------|
| `site/` only (landing or legal pages) | Nothing — Caddy serves from the bind mount |
| `src/` (page source, styles, tokens) | Run `npm run build` **locally** and commit the regenerated `site/` alongside the source; the server never builds |
| `Caddyfile` | `docker compose restart caddy` |
| `ghost-theme/` | `docker compose restart ghost` (Ghost caches the active theme). If files under `ghost-theme/assets/` changed, the commit also bumps `version` in `ghost-theme/package.json`; without that, browsers keep the cached CSS |
| `docker-compose.yml` or `.env` | `docker compose up -d` |
| Nothing — upstream security release (e.g. Node.js, MySQL, Caddy) | `docker compose pull && docker compose up -d` (`up -d` alone keeps the cached image for an unchanged tag) |

### Host updates and automatic reboots

Ubuntu's unattended upgrades install security updates daily. Kernel updates only take effect after a reboot, so the provisioning script writes `/etc/apt/apt.conf.d/52unattended-upgrades-local`, which lets unattended-upgrades reboot the server at 04:00 server time (UTC) whenever an installed update requires it. Expect about a minute of downtime; the containers come back on their own (`restart: unless-stopped`).

To apply the setting to a server provisioned before it existed, create the file by hand (re-running the whole provisioning script also works):

```bash
printf '%s\n' \
  'Unattended-Upgrade::Automatic-Reboot "true";' \
  'Unattended-Upgrade::Automatic-Reboot-Time "04:00";' \
  > /etc/apt/apt.conf.d/52unattended-upgrades-local
```

To check the state of the host, or to patch it immediately instead of waiting for the nightly run:

```bash
uname -r                           # running kernel
ls /var/run/reboot-required        # exists when a reboot is pending
apt update && apt upgrade -y       # install pending updates now
reboot                             # boot the new kernel now
```

### Major Ghost upgrades

Ghost's database migrations are one-way, so take a backup before changing the major version tag (for example `ghost:5-alpine` → `ghost:6-alpine`):

```bash
docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot --single-transaction "$MYSQL_DATABASE"' > ghost-$(date +%F).sql
docker run --rm -v paulwerner-net_ghost_content:/c -v "$PWD":/b alpine tar czf /b/ghost-content-$(date +%F).tgz -C /c .
docker compose pull ghost && docker compose up -d ghost
docker compose logs -f ghost   # wait for "Ghost booted"
```

Then confirm the runtime with `docker compose exec ghost node -v`, and check that the `paulwerner` theme is still active under Settings → Design.

## Verification checklist

- `https://paulwerner.net` — landing page renders, valid TLS, hero + about + footer
- `https://blog.paulwerner.net` — Ghost index, valid TLS
- `https://blog.paulwerner.net/ghost/` — admin reachable
- `/imprint/`, `/privacy/`, `/disclaimer/` — all three legal pages render under `paulwerner.net`
- Footer social icons link to GitHub, the blog, and LinkedIn (both on the landing page and on Ghost pages)
- After publishing a Ghost post, the landing page "Recent Posts" section populates
- `docker compose ps` reports all three services healthy
