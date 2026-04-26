# Session 012 — Imprint Address via Caddy Templates

## Goal

The imprint page (`site/imprint/index.html`) carried literal placeholders — `[STREET AND NUMBER]` and `[ZIP-CODE CITY]` — where the real postal address required by German DDG §5 must appear. The address must not enter git history or live on GitHub. Solve it without introducing a build step or a generated copy of the file.

## What was built

Caddy already serves `site/` statically and Caddy 2 ships with a `templates` directive that renders Go template syntax at request time. Two new env vars (`IMPRINT_STREET`, `IMPRINT_CITY`) flow from `.env` → Compose → the caddy container, and the imprint HTML now references them via `{{env "IMPRINT_STREET"}}` / `{{env "IMPRINT_CITY"}}`. The browser sees plain HTML with the address inlined; the source file in git contains only the template tags.

The `templates` directive is path-scoped to `/imprint/*` so the rest of the site stays as zero-overhead static serving with no template parsing.

## Key decisions

- **Path-scoped templates.** `templates /imprint/*` instead of an unscoped directive — only the one page that needs substitution pays the parsing cost, and the landing page's `{{...}}` Tailwind config script (if it ever uses brace patterns) can't accidentally collide with template syntax.
- **No build step, no generated file.** Caddy renders the source file in-memory on each request. The file in git is the file that ships; there is no `dist/` or pre-render pipeline to maintain.
- **Empty-on-missing is the desired failure mode.** Caddy's `env` function returns `""` for unset keys, so the page renders with blank lines rather than a 500 if the operator forgets the vars. Acceptable here because the imprint page is rarely the first thing checked after a deploy and the legal text around it still reads coherently.

## Commits

1. `62487c7` — `feat: serve imprint address from env via Caddy templates`

(Plus this session summary in a follow-up commit.)

## What's next

- Verify in production after the next `docker compose up -d` that `IMPRINT_STREET` and `IMPRINT_CITY` are set on the VPS — the operator-facing failure mode is silent (blank lines), so a quick `curl https://paulwerner.net/imprint/ | grep -A1 "Paul Werner"` after deploy is worth doing once.
- If more legal content ever needs request-time substitution (e.g. responsible-party name on the privacy page), the same pattern extends — broaden the `templates` matcher and add the relevant env vars.
