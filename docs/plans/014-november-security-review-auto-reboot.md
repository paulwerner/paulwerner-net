# Session 014 — November 2026 Security Review: Automatic Reboots for Kernel Updates

## Context

A review of security advisories published since session 013 (2026-10-21), checked against what the stack actually runs:

| Component | Advisory | Affected | Fixed in |
|---|---|---|---|
| Ubuntu 24.04 kernel (host) | CVE-2026-98432 — TCP use-after-free, remote code execution, Critical 9.8 | Yes, until the host runs a fixed kernel | `linux` 6.8.0-149.149 |
| Ubuntu 24.04 kernel (host) | CVE-2026-99288 ("NoisyTCP") — remote kernel panic | Yes | No fix released for 24.04 yet |
| Ghost | 11 advisories published 2026-11-13, including GHSA-fxxr-gqx3-p253 (High, brute-force protection bypass on staff sign-in) | Yes on 6.72.0 | 6.76.0 (for the advisories read in full) |
| Node.js (Ghost runtime) | 2026-11-11 security release, 16 CVEs | Largely not: the High-rated bugs need an HTTP/2 or TLS server, and Ghost serves cleartext HTTP/1.1 behind Caddy | 22.23.5 |
| Caddy | 5 advisories published 2026-11-04 | No: they need FastCGI/PHP, `try_files`, or a `{host}`-derived root | 2.11.8 |
| MySQL | Oracle Critical Patch Update, October 2026 | Low exposure: reachable only inside the Compose network | 8.4.13 |

Findings:

- **The image tags need no change.** Registry metadata for the arm64 images shows `ghost:6-alpine` at Ghost 6.78.0 on Node 22.23.5, `caddy:2-alpine` at v2.11.9, and `mysql:8` at 8.4.13. `docker compose pull && docker compose up -d` on the server picks all of them up.
- **The host has a gap.** `scripts/deploy-server.sh` enables unattended upgrades but leaves automatic reboots at the Ubuntu default (off). A patched kernel is therefore installed but not booted until someone reboots by hand, so a kernel fix such as the one for CVE-2026-98432 does not take effect on its own.
- The Ghost brute-force bypass carries more weight here than usual, because staff device verification is off until SMTP is configured (session 010). The admin password is the only barrier.

## Approach

Close the host gap in the provisioning script: have unattended-upgrades reboot the server automatically when an installed update requires it, at 04:00 server time. The settings go into a separate drop-in file under `/etc/apt/apt.conf.d/`, so the packaged `50unattended-upgrades` stays untouched and the step stays idempotent.

Trade-off accepted: roughly a minute of downtime in the early morning whenever a kernel (or other reboot-requiring) update lands. All three containers use `restart: unless-stopped`, so the stack comes back without intervention.

The server-side rollout (package upgrade, reboot, image pull) is done by hand and is not part of this session's commits.

## Steps

1. **Provisioning script**: in `scripts/deploy-server.sh`, write `/etc/apt/apt.conf.d/52unattended-upgrades-local` with `Automatic-Reboot "true"` and `Automatic-Reboot-Time "04:00"` as part of the unattended-upgrades step.
2. **Docs**: in `docs/deployment.md`, describe the automatic reboot, how to apply it to the existing server, and how to check for a pending reboot. Update CLAUDE.md, which still says the `scripts/` directory does not exist.

## Verification

- `bash -n scripts/deploy-server.sh` passes.
- The drop-in content parses with `apt-config` and yields the two expected values.
- Running the step twice produces an identical file (idempotent).
