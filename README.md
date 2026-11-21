# paulwerner.net

Content infrastructure for paulwerner.net — a static landing page at the root domain and a self-hosted Ghost blog at `blog.paulwerner.net`.

## Architecture

A single VPS (Hetzner CAX11 in Nuremberg, Ubuntu 24.04 ARM64) runs four containers via Docker Compose: **Caddy** (reverse proxy + static file server, terminates TLS via Let's Encrypt), **Ghost 6** (blog CMS), **MySQL 8** (Ghost's database), and a small **booking service** (Node.js, SQLite) behind `/book/` that syncs with Proton Calendar. Caddy is the only service that publishes ports; it serves the landing page directly from a bind-mounted `site/` directory and reverse-proxies the blog subdomain to Ghost.

## Building the site

The landing and legal pages are generated. `src/` holds the source (EJS
templates, the Tailwind entry point, brand tokens, assets); `build.mjs` writes
`site/`, which is committed and served straight from the bind mount — the
production server never builds.

```bash
npm install
npm run build        # src/ -> site/, then commit both
npm run dev          # rebuild on change
```

Anything under `src/` requires a rebuild and the regenerated `site/` committed
in the same change. Two checks worth running after edits:

```bash
npm run contrast              # WCAG ratios for every brand token pair
npm run verify:no-third-party # fails if any served file references an external origin
```

## Local development

```bash
cp .env.example .env   # fill in real values
docker compose up -d
```

- Landing page: <http://localhost/>
- Ghost admin: <http://blog.localhost/ghost/>

For local use set `DOMAIN=http://localhost`, `BLOG_SUBDOMAIN=http://blog.localhost` and `GHOST_URL=http://blog.localhost` in `.env`.

To try the booking page without a Proton account, add the dev overlay. It swaps the busy calendar for a fixture file and sends mail to a local inbox at <http://localhost:8025>:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
cd booking && npm ci && npm test    # unit tests
```

## Production

- Landing page: <https://paulwerner.net>
- Blog: <https://blog.paulwerner.net>

Server provisioning and the deploy/update workflow are documented in [docs/deployment.md](docs/deployment.md).

## More

- [CLAUDE.md](CLAUDE.md) — directory layout, session workflow, conventions
- [docs/decisions/001-hosting-using-hetzner.md](docs/decisions/001-hosting-using-hetzner.md) — hosting plan, cost, backup strategy
- [docs/brand/brand-guidelines.md](docs/brand/brand-guidelines.md) — colors, typography, components
- [docs/decisions/003-static-build-tailwind-v4-and-ejs.md](docs/decisions/003-static-build-tailwind-v4-and-ejs.md) — why Tailwind v4 and EJS
