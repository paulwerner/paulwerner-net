# Session 010 — Disable Ghost Staff Device Verification

## Goal

Production admin login at `blog.paulwerner.net/ghost` was blocked: Ghost 5's staff device verification was emailing a 2FA code to unrecognized devices, and the placeholder SMTP config (`smtp.example.com`) meant the email never sent — leaving the operator stuck on the sign-in form. Disable the verification step until a real SMTP provider is wired up, in a way that doesn't quietly break login again on the next deploy.

## What was built

### Config toggle

Ghost reads nested config from environment variables using double-underscore notation, so `security__staffDeviceVerification=false` maps to `{ "security": { "staffDeviceVerification": false } }`. Ghost's loader passes `parseValues: true` to nconf, so the env-var string `"false"` is coerced to boolean `false` — the key works as documented.

Added the var to the Ghost service's `environment:` block in `docker-compose.yml`, plumbed through a new `SECURITY_STAFF_DEVICE_VERIFICATION` env var, and documented it in `.env.example`.

### Default value

Initially shipped the compose default as `${SECURITY_STAFF_DEVICE_VERIFICATION:-true}` (fail-safe = secure). On deploy, that backfired: production's `.env` did not declare the new variable, so the safe default kicked in, verification stayed on, and the bug we set out to fix was unchanged.

Flipped the default to `${...:-false}`. Rationale: the project's *current state* is "no SMTP yet" — so the default should match reality, not an idealised future. When SMTP is wired up later, the default flips back to `true` (or the var is set in `.env`) as part of that change.

### Documentation

- `docs/learnings/003-docker-compose-restart-doesnt-reload-env.md` — captures the diagnostic miss that made this session take longer than it should have. `docker compose restart` does not pick up env-var changes from compose-file edits; only `docker compose up -d` recreates the container with the new spec. `docker compose config` reads the YAML and so cannot detect the drift between desired and running spec.

## Key decisions

- **Compose default = `false`, not `true`.** The "safe default" pattern (`${VAR:-true}`) is right when the safe value matches current project reality. When it doesn't — as here, where the safe value deterministically breaks the only login path — the default should track reality and the operator opts back in once the prerequisite (SMTP) is in place. Otherwise the unconfigured path silently re-creates the exact failure the variable was meant to fix.
- **Don't amend or revert; layer corrections.** The first fix was incomplete. Rather than rewriting the first commit, the default-flip went in as a second commit (`3d4d44c`) on top, keeping the history honest about what was tried and what corrected it.
- **Diagnose before re-editing.** The user explicitly asked for a careful root-cause read before changing more code. The compose default and the `.env` template were both technically correct — the actual blocker was a `restart` vs. `up -d` confusion on the deploy side. Two commits of churn would have been zero if the diagnostic step had come first.

## Commits

1. `8391467` — `fix: disable Ghost staff device verification until SMTP is configured`
2. `3d4d44c` — `fix: default staffDeviceVerification to false in compose`

(Plus this session summary and learning 003, in a follow-up commit.)

## What's next

- When an SMTP provider is chosen and wired up, flip the compose default back to `true` (or set `SECURITY_STAFF_DEVICE_VERIFICATION=true` in production `.env`) and verify that the verification email actually arrives. Track this as a follow-up — verification should be re-enabled in production as soon as mail works.
- Standing reminder for future env-var or volume edits: deploy with `docker compose up -d <service>`, never `restart`. See learning 003.
