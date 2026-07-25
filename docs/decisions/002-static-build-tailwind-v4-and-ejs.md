# 002 — Static build: Tailwind v4 (CSS-first) and EJS

**Status:** Accepted — July 2026
**Context:** Session 013 (compliance baseline)

## Problem

The landing and legal pages loaded Tailwind from the Play CDN and declared their
brand tokens in an inline `tailwind.config` copy-pasted into each of the four
HTML files. That meant a third-party request on every page view, no way to keep
tokens consistent except discipline, and no place to put shared markup — the
`<head>`, footer, and page chrome were duplicated four times.

Removing the CDN forces a build. This record covers the two choices that build
required: which Tailwind, and what templating.

## Decision 1: Tailwind v4.3.3 with a CSS-first `@theme` block

The session originally chose v3.4 under a constraint that no dependency may ship
native binaries with architecture-specific behaviour. That constraint was lifted
— the build runs on one workstation, `site/` ships committed, and nothing
compiles on the VPS — so the decision was re-taken on merits.

**Why v4:**

- **It fits how this codebase uses tokens.** Hand-written CSS here needs the raw
  values: the hero gradient, `::selection`, the grain overlay, the `@font-face`
  block. v4's `@theme` emits every token as a real CSS custom property
  automatically. Under v3 the JS config cannot be read from CSS, so the same ten
  hex values would need a hand-maintained `:root` block beside it — reinstating
  the duplication this session exists to remove. This is the deciding argument.
- **Currency.** v3.4 is in maintenance. A greenfield build in 2026, on a site
  whose pitch is technical currency, should not open on an EOL-track major.
- **One less indirection.** No `tailwind.config.js`; `src/styles/tokens.css` is
  both the token definition and part of the compiled input.

**Browser baseline, assessed rather than assumed.** v4 requires Safari 16.4+,
Chrome/Edge 111+ (both March 2023) and Firefox 128+. Compiling this site's real
class set produces 45 `@property` rules — all of them transform sub-properties,
where the fallback is that transforms still apply and only per-part
interpolation degrades — and exactly one `color-mix()` declaration, which
Tailwind already wraps in `@supports (color: color-mix(in lab, red, red))`. No
layout, colour, or typography on these pages depends on an unsupported feature.
The visitors in question are German SME decision-makers on corporate Windows
fleets running evergreen Edge or Chrome; the exposed group is Firefox 115 ESR
holdouts, who get graceful degradation rather than a broken page. Accessibility
conformance does not touch these features at all.

**Reproducibility.** Repeated builds on x86_64 produce byte-identical CSS. The
lockfile pins all twelve platform bindings, and `npm ci --os=darwin --cpu=arm64`
resolves `@tailwindcss/oxide-darwin-arm64` cleanly, so an Apple Silicon
workstation installs the same tree. Cross-architecture *execution* was not
verified — the environment this was built in has the Docker CLI but no daemon,
so an arm64 run was not possible. The backstop is structural: `site/` is
committed, so any divergence between machines shows up as a diff in review and
cannot reach the server silently.

**Cost accepted.** v4 is a younger major with a smaller body of published
workarounds, and the ecosystem's plugin story differs from v3's. Neither matters
here — this build uses no Tailwind plugins.

## Decision 2: EJS for templating

The pages needed a way to share `<head>`, the footer, and the legal-page header
across five files. EJS was chosen over Handlebars, Nunjucks, and Mustache for
one decisive reason and two supporting ones.

**Decisive:** Caddy renders `{{env "IMPRINT_STREET"}}` and
`{{env "IMPRINT_CITY"}}` inside `site/imprint/index.html` at request time via
the `templates` directive, reading values from `.env` that are deliberately not
in git. Every `{{ }}`-delimited engine would consume or mangle those
placeholders, and the failure mode is an imprint served without an address —
a legal defect, in production, from a templating detail. EJS uses `<% %>`, so
the placeholders pass through untouched. `build.mjs` asserts both survive each
render and fails the build otherwise, so this cannot regress silently.

**Supporting:** one dependency with no native code; and it carries layout,
partials, and per-page data without becoming a framework.

**Reuse.** The planned `/projects` case-study pages and future static showcases
in this repo should use the same mechanism: add an entry to `src/data/pages.js`
and a template under `src/pages/`, and the footer navigation, sitemap, and page
chrome follow automatically. That reuse was weighed in this decision; nothing
was built for it here.

## Consequences

- `src/` is hand-written source; `site/` is generated output that stays
  committed, because the production server only runs `git pull`.
- Generated HTML carries a banner comment naming its source template.
- Editing anything under `src/` requires `npm run build` and committing the
  regenerated `site/` in the same change.
- `ghost-theme/` stays outside this build. It is hand-written, has its own
  `:root` token block, and is loaded by Ghost rather than served from `site/`.
  The ten brand hex values therefore exist in two places — accepted knowingly;
  unifying them would make part of the theme generated and couple every token
  change to a Ghost theme version bump.
