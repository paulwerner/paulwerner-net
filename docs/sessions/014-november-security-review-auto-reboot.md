# Session 014 — November 2026 Security Review: Automatic Reboots for Kernel Updates

## Goal

Check whether the site is affected by the security advisories published since session 013, and ship fixes where needed.

## What was found

| Component | Advisory | Affected | Fixed in |
|---|---|---|---|
| Ubuntu 24.04 kernel (host) | CVE-2026-98432 — TCP use-after-free, remote code execution, Critical 9.8 | Yes, until the host runs a fixed kernel | `linux` 6.8.0-149.149 |
| Ubuntu 24.04 kernel (host) | CVE-2026-99288 ("NoisyTCP") — remote kernel panic | Yes | No fix released for 24.04 at the time of the review |
| Ghost | 11 advisories published 2026-11-13, including GHSA-fxxr-gqx3-p253 (High, brute-force protection bypass on staff sign-in) | Yes on 6.72.0 | 6.76.0 (for the four advisories read in full) |
| Node.js (Ghost runtime) | 2026-11-11 security release, 16 CVEs | Largely not: the High-rated bugs need an HTTP/2 or TLS server, and Ghost serves cleartext HTTP/1.1 behind Caddy | 22.23.5 |
| Caddy | 5 advisories published 2026-11-04 | No: they need FastCGI/PHP, `try_files`, or a `{host}`-derived root | 2.11.8 |
| MySQL | Oracle Critical Patch Update, October 2026 | Low exposure: reachable only inside the Compose network | 8.4.13 |

The floating image tags already resolved to patched versions (Ghost 6.78.0 on Node 22.23.5, Caddy 2.11.9, MySQL 8.4.13), so the repo needed no image change.

The gap was on the host. The provisioning script enabled unattended upgrades but left automatic reboots off, so a patched kernel would be installed without ever being booted.

## What was built

- `scripts/deploy-server.sh`: the unattended-upgrades step now writes `/etc/apt/apt.conf.d/52unattended-upgrades-local`, which lets unattended-upgrades reboot the server at 04:00 server time when an installed update requires it.
- `docs/deployment.md`: new "Host updates and automatic reboots" section — what the setting does, how to apply it to an already-provisioned server, and how to check for a pending reboot.
- CLAUDE.md: describes the `scripts/` directory, which it previously listed as not yet scaffolded.

## Key decisions

- **Reboot automatically rather than by hand.** About a minute of early-morning downtime on kernel updates is acceptable for a personal blog, and the containers restart on their own (`restart: unless-stopped`).
- **Separate drop-in file.** The packaged `50unattended-upgrades` stays untouched, and re-running the script rewrites an identical file.
- **Containers stay manual.** Image updates still need `docker compose pull && docker compose up -d`; automating them was not in scope.

## Verification

- `bash -n scripts/deploy-server.sh` passes.
- The generated drop-in parses with `apt-config` and yields the two expected values; generating it twice gives an identical file.
- The script change was not run end to end on an Ubuntu host.

## Server rollout (done by hand during the session)

- Packages upgraded and server rebooted; images pulled and the stack restarted. The server runs the fixed versions listed above or newer.
- The drop-in file was created manually on the existing server, so it already matches what the script now provisions.

## Commits

1. `8a24882` — `docs: add session 014 plan (November security review, automatic reboots)`
2. `0d7e603` — `feat(deploy): reboot automatically after updates that require it`
3. `5db30ff` — `docs: document automatic reboots and host patching`

(Plus this session summary.)

## What's next

- Watch for the Ubuntu 24.04 kernel fix for CVE-2026-99288. It will install and reboot on its own once released; confirm afterwards with `uname -r`.
- Seven of the eleven Ghost advisories from 2026-11-13 were only read by title. Confirm their fixed versions if any of the affected features (comments, imports, private site mode) come into use.
- Configure SMTP and re-enable staff device verification, so the admin password is no longer the only barrier to the Ghost admin.
- CLAUDE.md names the server plan as CX23, while README.md, `docs/deployment.md` and the provisioning script say CAX11. Settle which is correct and align them.
