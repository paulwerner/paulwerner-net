# paulwerner.net

Content infrastructure for paulwerner.net — a static landing page at the root domain and a self-hosted Ghost blog at `blog.paulwerner.net`.

## Architecture

A single VPS runs three containers via Docker Compose: **Caddy** (reverse proxy and static file server, handles TLS), **Ghost** (blog CMS), and **MySQL** (Ghost's database). Caddy is the only service that publishes ports; it terminates HTTPS on 80/443, serves the landing page directly from a bind-mounted `site/` directory, and reverse-proxies the blog subdomain to Ghost.

See [docs/decisions/001-hosting-using-hetzner.md](docs/decisions/001-hosting-using-hetzner.md) for hosting provider, plan sizing, and backup strategy.

## Running locally

> This repo is currently in Phase 1 — the Compose stack is a skeleton and is not yet wired for a full run. Phase 3 will finalise it.

Eventually:

```bash
cp .env.example .env   # fill in real values
docker compose up -d
```

## Repository layout

See [CLAUDE.md](CLAUDE.md) for the full directory structure, session workflow, and conventions.

## Brand

Brand guidelines will be added to `docs/brand/` in Phase 2.
