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

The script is idempotent — safe to re-run. It updates packages, enables unattended security upgrades, disables SSH password auth, configures UFW (22/80/443), installs Docker + Compose, creates a 1 GB swapfile, clones the repo into `/opt/paulwerner-net`, and seeds a `.env` from `.env.example`.

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
2. **Settings → Integrations → Add Custom Integration** → name it `Website`. Copy the Content API key.
3. **Locally**, edit `site/index.html` and replace `REPLACE_WITH_PRODUCTION_API_KEY` with the copied key. Commit and push:
   ```bash
   git commit -am "feat(site): add production Ghost Content API key"
   git push
   ```
4. On the server: `cd /opt/paulwerner-net && git pull` — Caddy serves `site/` from the bind mount, no restart needed.
5. **Settings → Navigation** → ensure a `Home` entry points to `https://paulwerner.net/` so blog visitors can return to the main site.

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
| `Caddyfile` | `docker compose restart caddy` |
| `ghost-theme/` | `docker compose restart ghost` (Ghost caches the active theme) |
| `docker-compose.yml` or `.env` | `docker compose up -d` |

## Verification checklist

- `https://paulwerner.net` — landing page renders, valid TLS, hero + about + footer
- `https://blog.paulwerner.net` — Ghost index, valid TLS
- `https://blog.paulwerner.net/ghost/` — admin reachable
- `/imprint/`, `/privacy/`, `/disclaimer/` — all three legal pages render under `paulwerner.net`
- Footer social icons link to GitHub, the blog, and LinkedIn (both on the landing page and on Ghost pages)
- After publishing a Ghost post, the landing page "Recent Posts" section populates
- `docker compose ps` reports all three services healthy
