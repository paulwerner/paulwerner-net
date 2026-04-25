# paulwerner.net

Content infrastructure for paulwerner.net — a static landing page at the root domain and a self-hosted Ghost blog at `blog.paulwerner.net`.

## Architecture

A single VPS (Hetzner CAX11 in Nuremberg, Ubuntu 24.04 ARM64) runs three containers via Docker Compose: **Caddy** (reverse proxy + static file server, terminates TLS via Let's Encrypt), **Ghost 5** (blog CMS), and **MySQL 8** (Ghost's database). Caddy is the only service that publishes ports; it serves the landing page directly from a bind-mounted `site/` directory and reverse-proxies the blog subdomain to Ghost.

## Local development

```bash
cp .env.example .env   # fill in real values
docker compose up -d
```

- Landing page: <http://localhost/>
- Ghost admin: <http://blog.localhost/ghost/>

## Production

- Landing page: <https://paulwerner.net>
- Blog: <https://blog.paulwerner.net>

Server provisioning and the deploy/update workflow are documented in [docs/deployment.md](docs/deployment.md).

## More

- [CLAUDE.md](CLAUDE.md) — directory layout, session workflow, conventions
- [docs/decisions/001-hosting-using-hetzner.md](docs/decisions/001-hosting-using-hetzner.md) — hosting plan, cost, backup strategy
- [docs/brand/brand-guidelines.md](docs/brand/brand-guidelines.md) — colors, typography, components
