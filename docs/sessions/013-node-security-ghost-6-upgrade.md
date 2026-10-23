# Session 013 — Node.js October 2026 Security Release: Upgrade to Ghost 6

## Goal

Check whether the site is affected by the Node.js security release of 2026-10-21 (10 CVEs, including the Brotli decoder RCE CVE-2026-111497). If it is, ship the fix.

## What was found

Ghost is the only Node.js workload in the stack. The pinned `ghost:5-alpine` image runs Node v20.20.0 with Ghost 5.130.6. Both Ghost 5 and Node 20 are end of life. The 5.x image line was dropped from the official Docker library in February 2026, so the tag will never receive a patched runtime. The site was affected, and it could not be fixed while it stayed on Ghost 5.

`ghost:6-alpine` (Ghost 6.72.0), rebuilt on 2026-10-21, runs the patched Node v22.23.4.

## What was built

- `docker-compose.yml`: `ghost:5-alpine` → `ghost:6-alpine`.
- `docs/deployment.md`:
  - New update-workflow row for upstream security releases (`docker compose pull && docker compose up -d`).
  - New "Major Ghost upgrades" section with backup commands (`mysqldump` via `exec -T`, plus a tarball of the content volume), because Ghost migrations are one-way.
- CLAUDE.md and README.md now reflect Ghost 6.
- Decision record 002 and learning 004.

The theme needed no changes. `gscan --v6` reports no errors, and the one existing warning is the same as under `--v5`.

## Key decisions

- **Upgrade to Ghost 6 rather than patch around Ghost 5.** A custom Ghost 5 image on Node 22 would be unsupported, and Ghost 5 itself no longer receives fixes. See decision 002.
- **Keep the floating major tag (`6-alpine`).** This matches the other services and lets `docker compose pull` pick up future base-image security rebuilds without a repo change.

## Verification

- Ran a full local 5 → 6 upgrade on the same MySQL 8 and content volumes. The data included the `paulwerner` theme and a post with a code block and a tag.
  - Migrations ran cleanly, the theme stayed active, and `node -v` in the container reports `v22.23.4`.
  - Index, post, tag, RSS and admin pages return 200, an unknown path returns 404, and the Prism assets load.
- Ghost 6 logs a non-fatal ActivityPub webhook error when Ghost's hosted ActivityPub service is unreachable. The blog doesn't use that feature.

## Commits

1. `6bfb039` — `docs: add session 013 plan (Node.js security release, Ghost 6 upgrade)`
2. `7d05d09` — `fix(ghost): upgrade to ghost:6-alpine for Node.js Oct 2026 security fixes`
3. `92bcf25` — `docs: reflect Ghost 6 and document image refresh + major upgrade steps`
4. `fb288a5` — `docs: add decision 002 (upgrade to Ghost 6)`
5. `4c3c9d8` — `docs: add learning 004 (EOL major tags stop receiving runtime patches)`

(Plus this session summary.)

## What's next

- Deploy on the VPS:
  1. Back up first, following `docs/deployment.md` → "Major Ghost upgrades".
  2. Run `docker compose pull ghost && docker compose up -d ghost`.
  3. Confirm `docker compose exec ghost node -v` reports v22.23.4 or newer, and that the `paulwerner` theme is still active.
- Track the EOL dates of the pinned majors (Ghost 6, MySQL 8, Caddy 2) so a frozen tag doesn't go unnoticed again (learning 004).
