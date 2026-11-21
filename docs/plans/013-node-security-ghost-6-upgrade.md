# Session 013 — Node.js October 2026 Security Release: Upgrade to Ghost 6

## Context

On 2026-10-21 Node.js published security releases for all supported lines (26.12.1, 24.22.1, 22.23.4), fixing 10 CVEs: 4 High, 3 Medium and 3 Low. The most serious is CVE-2026-111497, a Brotli decoder out-of-bounds write that permits remote code execution. Several High-rated bugs also break TLS certificate hostname validation (CVE-2026-105483, CVE-2026-106069) and DNS name handling (CVE-2026-105482). Advisory: https://nodejs.org/en/blog/vulnerability/october-2026-security-releases

The only Node.js process in the stack is Ghost. Caddy is Go, MySQL is C++, and the landing page is static. The Ghost theme ships no server-side JS.

Findings:

- `docker-compose.yml` pins `ghost:5-alpine`. Ghost 5 reached end of life, and the 5.x image line was dropped from the official Docker library on 2026-02-05 (`TryGhost/docker-library-ghost` commit `e79d50b`, "Drop EOL 5.x"). The tag was last rebuilt on 2026-02-01.
- The final `ghost:5-alpine` image runs **Node v20.20.0** (Ghost 5.130.6). Node 20 is itself end of life. The advisory states that EOL lines are always affected, and no patched Node 20 will be released. **The site is affected and cannot be fixed while it stays on Ghost 5.**
- `ghost:6-alpine` was rebuilt on 2026-10-21 from `node:22-alpine3.23`. It runs **Node v22.23.4**, the patched release, with Ghost 6.72.0.

## Approach

Move the blog to `ghost:6-alpine`. This is the only supported image line, and it already carries the patched Node runtime. The other Ghost 6.0 breaking changes don't affect this stack:

- **Node 22 requirement**: handled by the image.
- **Removal of `?limit=all` on the API**: the theme uses no `{{#get}}` calls, and the landing page's Recent Posts fetch uses a small explicit limit.
- **No extension-less files served from the theme root**: none exist.

## Steps

1. **Bump image**: `ghost:5-alpine` → `ghost:6-alpine` in `docker-compose.yml`.
2. **Docs**: update CLAUDE.md and README.md (Ghost 5 → Ghost 6). In `docs/deployment.md`, add a row to the update workflow for refreshing images on security releases (`docker compose pull && docker compose up -d`), plus a one-off note for the major upgrade: back up first, because the migrations are one-way.
3. **Decision record**: `docs/decisions/002-upgrade-to-ghost-6.md`.
4. **Learning**: `docs/learnings/004-eol-major-tags-stop-receiving-runtime-patches.md`. A floating major tag of an EOL product stops getting base-image security fixes without any warning.

## Verification (done locally before pushing)

- `gscan --v6 ghost-theme/`: no errors. The one warning ("custom fonts") is the same one reported under `--v5`.
- Ran a full 5 → 6 upgrade against MySQL 8 on the same volumes. Booted `ghost:5-alpine`, created the owner, activated the `paulwerner` theme and published a post with a code block and a tag. Then switched to `ghost:6-alpine`.
  - Migrations ran cleanly and Ghost booted.
  - `node -v` in the container reports `v22.23.4`.
  - `/`, the post, `/tag/infra/`, `/rss/` and `/ghost/` return 200. An unknown path returns 404.
  - Theme CSS and the Prism assets are served, and the code block keeps `language-js`.
