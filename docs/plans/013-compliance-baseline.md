# 013 — Compliance baseline: zero third-party requests, WCAG 2.1 AA, truthful privacy

## Context

paulwerner.net is being repositioned as a portfolio selling DSGVO/BFSG compliance to German SMEs, and it violated that standard on every page:

- All four pages loaded Google Fonts (two origins) and the Tailwind Play CDN — three third parties receiving every visitor's IP, with no legal basis and no consent. `ghost-theme/default.hbs` loaded Google Fonts too.
- `/privacy/` claimed analytics that do not exist in the code and never did.
- Brand tokens were copy-pasted inline into four HTML files; there was no build.
- No accessibility statement, no `robots.txt`, no `sitemap.xml`.
- `README.md`, `docs/deployment.md` and `scripts/deploy-server.sh` described a CAX11 (ARM) server; the live machine is a CX23 (x86_64). CLAUDE.md was already right.

Outcome: the site becomes the proof of its own claim — zero external requests, measured AA conformance, a literally true privacy policy, one token source. No redesign, no new features; one new page (`/accessibility/`).

## Production constraints (verified against the repo)

- `./site` is bind-mounted read-only into Caddy and the server only runs `git pull` — so `site/` stays generated **and** committed; nothing builds on the server.
- Caddy renders `{{env "IMPRINT_STREET"}}` / `{{env "IMPRINT_CITY"}}` in the imprint at request time. The build must emit those bytes untouched (rules out any `{{ }}` templating engine) and assert it.
- Output paths must not move; `docker-compose.yml` and `Caddyfile` stay untouched.

## Decisions

Recorded in [decision 002](../decisions/002-static-build-tailwind-v4-and-ejs.md): Tailwind v4.3.3 with a CSS-first `@theme` (hand-written CSS needs the token values as custom properties) and EJS (`<% %>` delimiters leave Caddy's placeholders intact). Fonts ship strictly by what each artefact renders — the old Google request was wrong in both directions ([learning 004](../learnings/004-font-stacks-are-not-inventories.md)). The Ghost theme keeps its own `:root` token copy, deliberately.

## Work items (one commit each)

- **Build** — root `package.json` + `build.mjs` + `src/` (page registry in `data/pages.js`, EJS pages/partials/layout, `tokens.css` `@theme`, `main.css`). Renders to the same `site/` paths with a generated-file banner, compiles minified CSS, asserts the imprint placeholders. Behaviour-neutral except one deliberate fix: the legal pages' dead `href="#"` social links get the real targets the landing page already uses.
- **Third-party removal** — drop Play CDN and Google Fonts from site and theme; self-host from `@fontsource` (OFL, latin, woff2, `font-display: swap`, licences shipped); convert `TravelingTypewriter.otf` → woff2 as a one-off dev step (the `.otf` stays in `src/` as source); preload only above-the-fold faces; bump the theme version (learning 002). Ghost Content API keys stay — they are read-only and public by design.
- **Privacy rewrite** — describe actual processing: no cookies/analytics/third parties, no consent banner (Sec. 25 (2) no. 2 TDDDG), Hetzner as Art. 28 processor, logs under Art. 6 (1) f), the blog fetch disclosed as own infrastructure, Ghost's handling described separately.
- **A11y pass** — skip link on every page (site + theme), styled rather than hidden scrollbar, global `:focus-visible` outline, `figure`/`figcaption` for the hero quote, reduced-motion honoured in JS, theme heading order fixed (`h1` on the post index, cards `h2`). Contrast measured from the shipped tokens; `border` is decorative-only. New `/accessibility/` statement: voluntary conformance (BFSG micro-enterprise exemption, Sec. 2 no. 17 / Sec. 3 (3) BFSG), MLBF as market surveillance authority — cited by postal address, email and website; the phone number is omitted because sources disagree and `mlbf-barrierefrei.de` is unreachable through this environment's proxy (flagged for manual confirmation). Plus scope, self-assessment method and date, known limitations, feedback route.
- **robots.txt + sitemap.xml** — sitemap generated from the page registry with hand-set `lastmod` so rebuilds are deterministic; robots.txt is per-host, future demo subdomains serve their own.
- **Server docs** — CAX11/ARM → CX23/x86_64 in README, deployment doc, and the provisioning script's header comments only (the logic already derives the architecture at runtime). Plans/sessions keep their CAX11 references as historical records.
- **Docs** — decision 002, learning 004 if implementation surprises, CLAUDE.md and README refresh; session summary only after acceptance.

## Verification (results go in the PR)

1. grep for third-party origins over served HTML/CSS/hbs → zero matches (the two `jsdelivr` hits in vendored `prism.js` are attribution comments, not requests).
2. Browser request log per page → same-origin only, all five pages.
3. axe-core on all five pages → zero violations.
4. Lighthouse on all five pages.
5. Contrast table computed from `src/styles/tokens.css`, so the numbers provably match shipped tokens.
6. Full-page before/after screenshots, desktop + mobile, every difference annotated.
7. Imprint placeholders byte-identical to `main` (also asserted by the build). The live Caddy render cannot be exercised here — no Docker daemon.
8. `grep -riE "cax11|arm64|aarch64"` → hits only under `docs/plans/` and `docs/sessions/`.
9. Fresh-clone check: `site/` serves with no `node_modules`; a rebuild reproduces it byte-for-byte.

## Flagged, not fixed

- `.gitignore` still ignores `landing-page/dist/` (gone) and has a global `dist/` rule that will swallow future app output.
- Brand-token hexes exist in both `src/styles/tokens.css` and the theme's `:root` (deliberate).
- `docs/deployment.md` hardcodes the production IPv4.
- No CSP / security headers — requires editing `Caddyfile`; follow-up session.

Branch: `claude/portfolio-compliance-baseline-xfrok4`; one commit per work item, each independently revertible.
