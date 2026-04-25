# Session 009 — Post Card Width Alignment

## Goal

Make the post cards on the blog index (`blog.paulwerner.net`) match the post cards on the landing page (`paulwerner.net`) — same width, padding, typography, hover behavior — so both properties feel visually identical. Final polish pass before calling the site done. Plus a small follow-up: keep the blog navigation `Home` link a single color across all states.

## What was built

### Card-width alignment

The card-level styles (padding, border, gap, hover, typography) already matched the brand spec on both sides. The actual mismatch was on the Ghost side, in `ghost-theme/assets/css/theme.css`:

- **`.site-main` width rule** — restructured to default to `max-width: var(--index-width)` (780px, listing-style), with `.post-template .site-main, .page-template .site-main` narrowing to `var(--content-width)` (720px, reading column). Removes the dependency on `home-template` / `tag-template` / `paged` body classes being present, since listings are the common case and single-post is the exception.
- **Explicit `width: 100%` on `.site-main`** — the body uses a flex sticky-footer layout (`display: flex; flex-direction: column`). Declaring `width` explicitly makes the element claim full container width independent of flex item cross-axis behavior, which is implicit and can be perturbed by third-party CSS injected later in the cascade. See learning 001 for the specific case (sodo-search Tailwind preflight) that surfaced this.

The landing-page CSS (`max-w-[780px]` on `#posts-section` in `site/index.html`) was already correct and needed no changes.

### Navigation link color unification

`.site-nav__link` was reading `var(--muted)` by default and only switching to gold on `:visited` (via the global `a:visited { color: var(--gold) }` rule), which made the `Home` link change color after the first click. Unified default / `:visited` / `:hover` to `var(--gold)` so the link stays the same warm gold across all states. The `.is-current { color: var(--accent) }` override is preserved for nav items pointing at the current page.

### Documentation

- **`docs/learnings/001-sodo-search-preflight-shrinks-flex-children.md`** — captures why explicit `width` declarations are preferable to implicit flex-item stretch when third-party scripts inject CSS.
- **`docs/learnings/002-ghost-asset-hash-is-per-theme-version-not-per-file.md`** — captures the Ghost asset-hash behavior: `?v=<hash>` is per-theme-version, not content-derived, so `package.json` `version` must be bumped on every theme edit to bust the year-long browser cache.

## Key decisions

- **`.site-main` defaults to listing width, not reading width.** Inverting the previous body-class-scoped rule makes the layout "wide unless explicitly narrowed for reading." Listings are the common case; enumerating every listing-context body class to opt them in was more fragile than declaring narrowing as the exception.
- **Brand spec stays at 780px.** `docs/brand/brand-guidelines.md` already specified 780px for listings — both properties now actually render at that value as the spec said they should.
- **Bump `package.json` version on every Ghost theme change.** Ghost's `?v=` asset hash is per-theme-version; without the bump, browsers serve year-cached old CSS even after a successful pull and restart. This is now part of the standing deploy ritual.
- **Nav link colors unified, not just removed.** Kept `.is-current { color: var(--accent) }` because it's a meaningfully different signal (you're here) versus the constant Home color.

## Commits

1. `07d444d` — `fix(layout): guarantee 780px cap on landing posts section and broaden Ghost listing width`
2. `adecd67` — `chore(ghost-theme): bump version to 0.1.1 to bust asset cache`
3. `8684fd1` — `fix(ghost-theme): force width:100% on .site-main to survive sodo-search preflight`
4. `7139a07` — `docs: add learning 001 on sodo-search preflight breaking flex-child width`
5. `1e824eb` — `fix(ghost-theme): keep nav link a single color across default/visited/hover`
6. `0958d7b` — `docs: add session 009 summary and learning 002 on Ghost asset hash`
7. `8414517` — `refactor: drop speculative landing-page fallback and rot-prone theme.css comment`

## Manual steps performed by user

For each Ghost-side change: `git pull` on the VPS → `docker compose restart ghost` → re-activate the theme at `https://blog.paulwerner.net/ghost/#/settings/design` (this is what makes Ghost read the new `package.json` version and emit a new `?v=` hash). Without re-activation the bump alone doesn't bust the cache.

## Verification

User confirmed final result on production: cards on `paulwerner.net` and `blog.paulwerner.net` align at the same width, single-post pages still render at the narrower 720px reading column, and the blog `Home` link stays the warm gold across all interaction states.

## What's next

Site is at "done" for the original scope. No follow-up work is queued.
