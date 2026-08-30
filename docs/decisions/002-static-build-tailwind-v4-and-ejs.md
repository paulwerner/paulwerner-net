# 002 — Static build: Tailwind v4 (CSS-first) and EJS

**Status:** Accepted — July 2026
**Context:** Session 013 (compliance baseline)

## Problem

The landing and legal pages loaded Tailwind from the Play CDN and duplicated the brand tokens in an inline `tailwind.config` per HTML file: a third-party request on every page view, tokens kept consistent only by discipline, and shared markup (`<head>`, footer) copy-pasted four times. Removing the CDN forces a build; this records the two choices it required.

## Decision 1: Tailwind v4.3.3 with a CSS-first `@theme` block

Originally planned as v3.4 under a no-native-binaries constraint. That constraint was lifted (the build runs on one workstation and `site/` ships committed), so the choice was re-taken on merits:

- **Fit — the deciding argument.** Hand-written CSS here needs the raw token values (hero gradient, `::selection`, grain overlay, `@font-face`). v4's `@theme` emits every token as a real CSS custom property; under v3 the JS config is unreadable from CSS, forcing a hand-maintained `:root` copy beside it — the exact duplication this build exists to remove.
- **Currency.** v3.4 is maintenance-only; a 2026 greenfield build should not open on an EOL-track major.
- **One less indirection.** No `tailwind.config.js`; `src/styles/tokens.css` is both the token definition and compiler input.

**Browser baseline** (Safari 16.4+, Chrome/Edge 111+, Firefox 128+), assessed against this site's actual compiled output rather than assumed: 45 `@property` rules — all transform sub-properties, where transforms still apply and only per-part interpolation degrades — and one `color-mix()` already wrapped in `@supports`. No layout, colour, or typography depends on an unsupported feature; the exposed cohort (Firefox ESR holdouts) gets graceful degradation, not a broken page.

**Reproducibility.** Repeated x86_64 builds are byte-identical; the lockfile pins all twelve platform bindings and resolves `@tailwindcss/oxide-darwin-arm64` cleanly. arm64 *execution* was not verifiable in the build environment. Backstop: `site/` is committed, so any cross-machine divergence surfaces as a reviewable diff and never reaches the server silently.

## Decision 2: EJS for templating

**Decisive:** Caddy renders `{{env "IMPRINT_STREET"}}` / `{{env "IMPRINT_CITY"}}` inside the imprint at request time, and any `{{ }}`-delimited engine (Handlebars, Nunjucks, Mustache) would consume those placeholders — the failure mode being an imprint served without an address, in production. EJS uses `<% %>`, and `build.mjs` asserts both placeholders survive every render.

**Supporting:** one dependency, no native code, carries layout + partials + per-page data without becoming a framework.

**Reuse:** future static pages (the planned `/projects` case studies) should follow the same mechanism — one entry in `src/data/pages.js`, one template under `src/pages/`; footer nav, sitemap and chrome follow automatically.

## Consequences

- `src/` is source; `site/` is generated, committed, and served. Every `src/` change ships with a rebuilt `site/` in the same commit.
- Generated HTML carries a banner naming its source template.
- `ghost-theme/` stays outside this build with its own `:root` token copy. The ten brand hexes therefore exist in two places — accepted knowingly; unifying them would make part of the hand-written theme generated output and couple every token change to a theme version bump.
