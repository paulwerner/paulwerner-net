# 015 — Compliance baseline

**Plan:** [docs/plans/015-compliance-baseline.md](../plans/015-compliance-baseline.md)
**Branch:** `claude/portfolio-compliance-baseline-xfrok4` → PR #2

## Why

The site is being repositioned as a portfolio selling DSGVO/BFSG compliance and violated that standard itself: Google Fonts plus the Tailwind Play CDN on every page (three third parties receiving visitor IPs with no legal basis), a privacy policy claiming analytics that never existed, no accessibility statement, no robots.txt or sitemap, brand tokens copy-pasted into four files, and server docs describing a CAX11 (ARM) that was never provisioned.

## What was built

- **Static build** (`build.mjs`): `src/` (EJS templates + Tailwind v4 `@theme` tokens) generates `site/`, still committed and served from the same paths — the server only runs `git pull`. The build fails on a contrast violation, missing skip-link utilities, or a lost Caddy imprint placeholder.
- **Zero third-party requests**: CDN and Google Fonts removed from site and theme; fonts self-hosted from `@fontsource` (OFL, woff2, licences shipped); TravelingTypewriter converted to woff2, the `.otf` kept in `src/` as source.
- **Truthful privacy policy**: no cookies/analytics/third parties, no consent banner (Sec. 25 (2) no. 2 TDDDG), Hetzner as Art. 28 processor, logs under Art. 6 (1) f), the home page's blog fetch disclosed as own infrastructure.
- **WCAG 2.1 AA** on all five pages and the Ghost theme — skip links, styled scrollbar, `:focus-visible`, reduced-motion in JS, theme heading order — plus `/accessibility/`: voluntary conformance under the BFSG micro-enterprise exemption, MLBF cited by address/email/contact form (phone omitted; sources disagreed).
- **Supporting**: favicon set derived from the avatar, robots.txt, generated sitemap.xml, contrast report promoted to build gate, CX23 correction across README/deployment doc/script comments.

## Key decisions

- Tailwind v4 + EJS: [decision 003](../decisions/003-static-build-tailwind-v4-and-ejs.md).
- Fonts audited by what the code renders, not by the request being replaced: [learning 005](../learnings/005-font-stacks-are-not-inventories.md).
- Token hexes stay duplicated between `src/styles/tokens.css` and the theme's `:root` — unifying would make part of the hand-written theme generated output.

## What verification caught

- Moving the skip link into the layout left `sr-only` un-compiled (the `@source` list didn't cover `layouts/`), so "Skip to content" rendered as visible text on every page. Invisible to axe and Lighthouse — the link is accessible, just not hidden — and caught only by the before/after screenshot diff. Fixed with one `@source "../"` directive plus a build assertion.
- A 48px height change that looked like a regression was v4 fixing a bug: the empty `#posts-list` carries both `hidden` and `flex`; v3's preflight let `.flex` win, v4 marks `[hidden]` `!important`.

## Final numbers

Third-party requests: 0 on all five pages (the one cross-origin request is the Ghost Content API call to our own blog, disclosed in the privacy policy). axe-core: 0 violations. Lighthouse accessibility: 100 everywhere. Tightest contrast pair: `muted` on `inset-bg` at 4.65, now build-enforced. A rebuild from a fresh clone reproduces the committed `site/` byte-for-byte.

## Commits

One per work item, conventional format: plan; build (`build(site)`); fonts/third-party removal (`fix(site)`); privacy rewrite (`docs(site)`); a11y pass (`fix(a11y)`); robots/sitemap (`feat(site)`); server-spec correction (`docs`); decision records (`docs`); `@source` fix (`fix(build)`); favicon (`feat(site)`); contrast gate (`feat(build)`); MLBF contact form (`docs(site)`).

Review pass on the PR added: meta description corrected to Hamburg (`fix(site)`), the third-party gate no longer passes on grep errors (`fix(build)`), comments and these docs condensed (`refactor`), theme bumped to 0.4.1.

## Open items

- MLBF details corroborated by search only — the authority's site was unreachable through the proxy. Verify once before treating the statement as final.
- Cross-architecture builds unverified (no arm64 execution possible here); the committed `site/` surfaces any divergence as a reviewable diff.
- `.gitignore`: stale `landing-page/dist/` entry and a global `dist/` rule.
- No CSP / security headers yet — a natural follow-up session alongside the planned `/projects` pages.

## Deploy notes

Nothing changes on the server. Locally, any `src/` change requires `npm run build` and committing the regenerated `site/` in the same change. The theme went 0.1.4 → 0.4.1 this session — re-activate it in Admin after deploying so the `?v=` asset hash changes (learning 002).

## Amendments before merge (2026-11-21)

The PR stayed open for four months. A second review pass, run against a live local stack (Caddy, Ghost 6.78, MySQL), changed the following. Statements above that conflict with this section are superseded by it.

- **Renumbered.** `main` had taken the numbers this session used, so the records became plan and session 015, decision 003 and learning 005. `main` was merged in (Ghost 6, automatic reboots).
- **Server spec reverted to CAX11 (ARM64).** The "CX23 correction" above was wrong: the server runs on a CAX11, confirmed by the owner. README, the deployment doc and the provisioning script say CAX11 again.
- **The blog still made third-party requests.** `{{ghost_head}}` injected Ghost's portal and search scripts from `cdn.jsdelivr.net` on every blog page. The source-level check could not see this, and the original session had no Docker daemon to render a page. The theme now excludes them.
- **Ghost wrote to browser storage.** With member source tracking on (the default), Ghost stores page history in `sessionStorage`. This is an Admin setting, now documented in `docs/deployment.md` as required to be off.
- **Blog posts failed AA contrast.** Post bodies render on a light panel, where links, quotes and captions were at 2.4:1, and Ghost's callout, bookmark and button cards were unreadable or below 4.5:1. Fixed in `theme.css`; theme 0.4.2. axe-core now reports 0 violations on all five site pages and on the blog index, tag page, 404 page and two posts (one with every common card type), at desktop and mobile widths.
- **Caddy imprint render verified.** The address placeholders render correctly through the real Caddy `templates` directive.
- **Build dependencies patched** (`npm audit fix`, two high-severity advisories, build-time only); the generated `site/` is unchanged.

Still open from the list above: the MLBF contact details, CSP/security headers, and the `.gitignore` entries. The accessibility statement's assessment date (25 July 2026) was left as written.
