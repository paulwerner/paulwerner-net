# Session 009 — Post Card Width Alignment

## Goal

Make the post cards on the blog index (`blog.paulwerner.net`) match the post cards on the landing page (`paulwerner.net`) — same width, padding, typography, hover behavior — so both properties feel visually identical. Final polish pass before calling the site done. Plus a small follow-up: keep the blog navigation `Home` link a single color across all states.

## What was built

### Card-width alignment (commits 07d444d → 8684fd1)

Three layered fixes were needed because the symptom (blog card narrower than landing) had **three independent causes**, each masking the next:

1. **`site/index.html`** — added `#posts-section { max-width: 780px; }` to the inline `<style>` block as a guaranteed fallback. The Tailwind Play CDN's JIT can fail to materialize bracket-arbitrary classes like `max-w-[780px]`; an inline rule pinned to the section's id removes that dependency.
2. **`ghost-theme/assets/css/theme.css`** — inverted the `.site-main` width rule. New default is `max-width: var(--index-width)` (780px); only `.post-template .site-main, .page-template .site-main` narrow to `var(--content-width)` (720px) for the reading column. Removes the dependency on the body carrying a `home-template` / `tag-template` / `paged` class.
3. **`ghost-theme/assets/css/theme.css`** — added explicit `width: 100%` to `.site-main`. This is the one that actually fixed production. Sodo-search injects its own Tailwind v3 preflight CSS at runtime *after* `theme.css` loads, which disturbs the body flex layout and causes `.site-main` (a flex item without an explicit width) to shrink-to-fit instead of stretching to its `max-width`. The defensive `width: 100%` bypasses flex-item cross-axis sizing entirely.

Each Ghost-side fix shipped with a `package.json` version bump (0.1.0 → 0.1.3) to force Ghost to emit a new asset cache hash — see learning 002.

### Navigation link color unification (commit 1e824eb)

`.site-nav__link` was reading `var(--muted)` by default and only switching to gold on `:visited` (via the global `a:visited { color: var(--gold) }` rule), making the `Home` link change color after the first click. Unified default / `:visited` / `:hover` to `var(--gold)` so the link stays the same warm gold across all states. The `.is-current` accent override is preserved for nav items pointing at the current page.

### Documentation

- **`docs/learnings/001-sodo-search-preflight-shrinks-flex-children.md`** — captures the root cause of the production-only narrowing and the `width: 100%` defensive pattern.
- **`docs/learnings/002-ghost-asset-hash-is-per-theme-version-not-per-file.md`** — captures the Ghost asset-hash gotcha that cost several debug iterations.

## Key decisions

- **Layered defensive fixes, not a single "minimal" change.** Each fix addresses a real, independently-confirmed failure mode. The Tailwind CDN fallback may or may not have been strictly required (we never proved it was misbehaving), but it's belt-and-suspenders against a known-fragile mechanism and the cost is one CSS line. The `.site-main` rule inversion is robustness-over-cleverness — defaulting to the listing width and explicitly narrowing for reading is more maintainable than enumerating every listing-context body class. The `width: 100%` was the actual production fix.
- **Bump theme version on every Ghost CSS change.** Ghost's `?v=` asset hash is per-theme-version, not per-file-content. Without the bump, browsers serve the year-cached old CSS even after a successful pull and restart. This is now a fixed step in any Ghost theme change going forward.
- **Brand spec stays at 780px.** The `docs/brand/brand-guidelines.md` 780px target was never changed — the bug was always renderer-side. Both properties now actually render at 780px as the spec already said they should.
- **Nav link colors unified, not removed.** Kept `.is-current { color: var(--accent) }` because it's a meaningfully different signal (you're here) versus the constant Home color.

## Commits

1. `07d444d` — `fix(layout): guarantee 780px cap on landing posts section and broaden Ghost listing width`
2. `adecd67` — `chore(ghost-theme): bump version to 0.1.1 to bust asset cache`
3. `8684fd1` — `fix(ghost-theme): force width:100% on .site-main to survive sodo-search preflight`
4. `7139a07` — `docs: add learning 001 on sodo-search preflight breaking flex-child width`
5. `1e824eb` — `fix(ghost-theme): keep nav link a single color across default/visited/hover`
6. `<this commit>` — `docs: add session 009 summary and learning 002`

## Manual steps performed by user

For each Ghost-side change: `git pull` on the VPS → `docker compose restart ghost` → re-activate the theme at `https://blog.paulwerner.net/ghost/#/settings/design` (this is what makes Ghost read the new `package.json` version and emit a new `?v=` hash). Without re-activation the bump alone doesn't bust the cache.

## Verification

User confirmed final result on production: cards on `paulwerner.net` and `blog.paulwerner.net` align at the same width, and the blog `Home` link stays the warm gold across all interaction states. Single-post pages still render at the narrower 720px reading column.

## What's next

Site is at "done" for the original scope. No follow-up work is queued.
