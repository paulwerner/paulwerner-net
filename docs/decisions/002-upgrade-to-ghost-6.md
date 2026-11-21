# Decision 002: Upgrade the Blog to Ghost 6

**Status:** Decided — October 2026
**Trigger:** Node.js security release of 2026-10-21

---

## Context

The Node.js project released fixes for 10 CVEs across the 26.x, 24.x and 22.x lines. One is a Brotli decoder out-of-bounds write that permits remote code execution (CVE-2026-111497), and several High-rated issues affect TLS hostname validation and DNS name handling. The fixed versions are 26.12.1, 24.22.1 and 22.23.4. EOL lines are affected and get no fix.

Ghost is the only Node.js workload in the stack. It ran on `ghost:5-alpine`. Ghost 5 is end of life, and its image line was removed from the official Docker library in February 2026. The last image is frozen on Node v20.20.0, an EOL runtime. No image tag for Ghost 5 will ever receive the patched runtime.

## Decision

Switch the `ghost` service to `ghost:6-alpine`. It is the supported image line, it tracks `node:22-alpine`, and its build of 2026-10-21 ships Node v22.23.4.

Keep the floating major tag (`6-alpine`) rather than pinning a digest or minor version. This matches how `caddy:2-alpine` and `mysql:8` are referenced: `docker compose pull` picks up base-image security rebuilds without a repo change.

## Alternatives considered

| Option | Why not |
|---|---|
| Stay on `ghost:5-alpine` | Permanently stuck on EOL Node 20, with no fix for this or any future Node CVE. |
| Custom image: Ghost 5 on `node:22-alpine` | Ghost 5 does not officially support Node 22, and Ghost 5 itself no longer gets security fixes. Maintaining a bespoke image contradicts the "simple solutions" constraint. |
| Pin `ghost:6.72.0-alpine` | Pinning gains reproducibility but blocks silent base-image security rebuilds. For a personal blog, prompt patching matters more. |

## Consequences

- The Ghost database migrations from 5 to 6 are one-way, so a backup is required before deploying (see `docs/deployment.md`, "Major Ghost upgrades").
- The theme passes `gscan --v6` with no errors and needed no changes.
- Ghost 6 adds ActivityPub ("Network") features. They depend on Ghost's hosted ActivityPub service and are not required for the blog. Without it, Ghost logs a non-fatal "Could not get webhook secret for ActivityPub" error on boot.
- Future upstream security releases are applied with `docker compose pull && docker compose up -d`.
