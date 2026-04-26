# Session 012 — Imprint Address via Caddy Templates

## Context

`site/imprint/index.html:66-67` currently contains literal placeholders `[STREET AND NUMBER]` and `[ZIP-CODE CITY]`. German DDG §5 requires the real postal address on the imprint, but the address must not enter git history or live on GitHub. Caddy already serves `site/` statically; its built-in `templates` directive can do request-time `{{env}}` substitution so the address only ever exists in the gitignored `.env` and the Caddy container's environment. No build pipeline, no generated files.

## Approach

Use Caddy's `templates` directive scoped to `/imprint/*` only (keeps zero-overhead static serving for the rest of the site). Pass `IMPRINT_STREET` / `IMPRINT_CITY` from `.env` → Compose → caddy container env, and reference them via `{{env "IMPRINT_STREET"}}` in the imprint HTML. Caddy renders the template before responding; the browser sees plain HTML with the address inlined.

## Changes

### 1. `.env.example`
Append a new section after the Caddy block:

```
# ---- Imprint address ----
# Postal address required by German DDG §5. Kept out of git — set in .env.
# Caddy renders these into site/imprint/index.html at request time via the
# `templates` directive (scoped to /imprint/* only).
IMPRINT_STREET=Your Street 123
IMPRINT_CITY=12345 City
```

### 2. `.env` (local, untracked)
Add the same two keys with the operator's real values (or placeholders if not yet known). Confirm with the user before writing real address values.

### 3. `docker-compose.yml` — caddy service
Add to the `environment:` block (after `BLOG_SUBDOMAIN`):

```yaml
      IMPRINT_STREET: ${IMPRINT_STREET}
      IMPRINT_CITY: ${IMPRINT_CITY}
```

### 4. `Caddyfile`
Inside the `{$DOMAIN}` block, add a path-scoped `templates` directive:

```
{$DOMAIN} {
    root * /srv/site
    encode gzip
    templates /imprint/*
    file_server
}
```

`templates` accepts a path matcher inline; only requests under `/imprint/` get parsed as Go templates.

### 5. `site/imprint/index.html`
Replace lines 66–67:

```html
        [STREET AND NUMBER]<br>
        [ZIP-CODE CITY]
```

with:

```html
        {{env "IMPRINT_STREET"}}<br>
        {{env "IMPRINT_CITY"}}
```

Indentation matches the surrounding `<p>` block.

## Critical files

- `Caddyfile` — add `templates /imprint/*`
- `docker-compose.yml` — pass two env vars to caddy
- `.env.example` — document the new keys
- `.env` — set local values (untracked)
- `site/imprint/index.html` — replace placeholders with `{{env}}` calls

## Verification

1. Set `IMPRINT_STREET` and `IMPRINT_CITY` in `.env`, then `docker compose up -d` (or `docker compose restart caddy` if already running — env changes need a recreate, so `up -d` is safer).
2. `curl -s http://localhost/imprint/ | grep -A1 "Paul Werner"` — body contains the address from `.env`, not `{{env ...}}` and not `[STREET AND NUMBER]`.
3. `curl -s http://localhost/ | grep -c "{{"` → `0` — landing page is unaffected by template processing.
4. `git diff site/imprint/index.html` — diff shows `{{env "IMPRINT_STREET"}}` / `{{env "IMPRINT_CITY"}}`, no real address.
5. Unset both vars in `.env`, `docker compose up -d`, visit `/imprint/` — page renders with empty lines where the address would be, no Caddy error page (Caddy's `env` returns `""` for missing keys).
6. `git status` — `.env` remains untracked, `site/imprint/index.html` is the only tracked file changed besides config.

## Commit plan

1. `feat: serve imprint address from env via Caddy templates` — single commit covering `.env.example`, `docker-compose.yml`, `Caddyfile`, `site/imprint/index.html`.
2. `docs: add session 012 summary` — only after the user accepts the implementation.
