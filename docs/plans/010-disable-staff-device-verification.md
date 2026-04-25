# Session 010 — Disable Ghost Staff Device Verification

## Context

Ghost 5 enforces staff device verification: when an admin signs in from an unrecognized device, Ghost emails a verification code before allowing access. Outbound mail is currently a placeholder (`smtp.example.com` in `.env.example`), so no real SMTP provider is wired up. The result is that admin login is blocked — Ghost tries to send a verification mail, the send fails (or is sent into a void), and the operator can't get back into `/ghost`.

The fix is to disable staff device verification via Ghost's config until an SMTP provider is configured. Ghost reads nested config from environment variables using double-underscore notation, so `security__staffDeviceVerification=false` maps to `{ "security": { "staffDeviceVerification": false } }`.

We expose this as a `.env` variable with a safe default (`true`) so that forgetting to set it does not silently weaken security; production `.env` will explicitly set it to `false` until SMTP works.

## Changes

### 1. `docker-compose.yml`

Add a new entry to the `ghost` service `environment` block, after the `mail__*` keys:

```yaml
      # Staff device verification (2FA via email on new devices).
      # Re-enable (true) once a real SMTP provider is configured.
      security__staffDeviceVerification: ${SECURITY_STAFF_DEVICE_VERIFICATION:-true}
```

Note: existing entries in this block use `key: ${VAR}` form (mapping syntax, not list form). Match that style — do not switch to the `- key=value` list form shown in the prompt.

### 2. `.env.example`

Append a new section after the `Ghost outbound mail` block:

```
# ---- Ghost staff device verification ----
# 2FA via email on unrecognized devices. Set to false while no SMTP provider
# is configured; re-enable (true) once outbound mail works.
SECURITY_STAFF_DEVICE_VERIFICATION=false
```

The template ships with `false` because the template already ships placeholder SMTP credentials — it documents the intended production starting state. The compose default remains `true` so an unset variable fails safe.

## Files

- `docker-compose.yml`
- `.env.example`

## Commit plan

Single commit:

- `fix: disable Ghost staff device verification until SMTP is configured`

## Verification

1. `docker compose config | grep -i staffDevice` — confirms the resolved value is passed to the Ghost service. With no `.env` override, expect `true`; with `SECURITY_STAFF_DEVICE_VERIFICATION=false` set, expect `false`.
2. After deploying with `false`: log out of Ghost admin, then log back in from an incognito window. Login should complete without an email-verification prompt.
3. Optional sanity: `docker compose up -d ghost && docker compose logs ghost | tail -n 50` — Ghost should boot cleanly with no config-key warnings.
