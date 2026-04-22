# Session 002 — Landing Page Implementation

## Outcome

The placeholder landing page is replaced with a complete five-section site at `site/index.html`: hero with harbor-backed amber-bordered card, About, Recent Posts (three placeholder cards), Projects (three placeholder items), and a three-column footer. Plain HTML + Tailwind via the Play CDN, no framework, no build step, no external dependencies beyond Tailwind and Google Fonts. Renders correctly when served over HTTP from the `site/` directory and is ready to land behind Caddy in Phase 3.

## What was built

- [docs/plans/002-landing-page.md](../plans/002-landing-page.md) — plan persisted from the Claude Code plans directory
- [site/index.html](../../site/index.html) — full landing page (replacing the 14-line placeholder):
  - Inline `tailwind.config` exposing the brand color tokens, font families (`typewriter`, `serif`, `mono`), the legacy card box-shadow, and a `hero-in` keyframe animation
  - `@font-face` for TravelingTypewriter, Google Fonts for Source Serif 4 / JetBrains Mono / Special Elite (fallback)
  - Global styles for selection color, `scroll-behavior: smooth` (with `prefers-reduced-motion` override), hero background layers, mobile background-attachment fallback, and inline SVG grain texture
  - Hero, About, Recent Posts, Projects, Footer — all rendered per `docs/brand/brand-guidelines.md` with mobile-first responsive sizing
  - End-of-body script: IntersectionObserver toggles the floating avatar; click handler smooth-scrolls the indicator to About; scroll listener fades the indicator over the first 200px of scroll
- [CLAUDE.md](../../CLAUDE.md) — Directory Structure tree extended to include `site/assets/` (avatar, harbor background) and `site/assets/fonts/TravelingTypewriter.otf`

## Key decisions made during implementation

- **Tailwind via Play CDN, not CLI.** The session prompt explicitly chose `https://cdn.tailwindcss.com` with an inline `tailwind.config`, contradicting CLAUDE.md's tech-stack claim that Tailwind is "compiled at build time via the Tailwind CLI." The session's deliverable list scoped the CLAUDE.md edit to *Directory Structure* only, so the tech-stack note was deliberately left untouched. Reconciliation belongs to a later session — either ratify CDN in CLAUDE.md or introduce a real CLI build step before Phase 3 ships.
- **Grain texture inlined as an SVG `feTurbulence` data URI** rather than committed as `assets/grain.svg`. Keeps the deliverable to a single HTML file, avoids an extra HTTP request, and the brand spec (3% opacity overlay) is easy to express inline.
- **Single avatar asset reused for both the 140px card and 44px floating instances.** Brand guidelines explicitly accept this for prototyping while flagging that production wants two sizes (88px source for the floating retina version). Honoured the open item — no new asset created.
- **Mobile-first responsive baseline.** Default classes target mobile; `sm:` (≥640px) modifier scales up the hero card width/padding, avatar size, h1 size, and footer column layout. Section vertical paddings are eased on mobile too. `background-attachment: fixed` falls back to `scroll` below 640px to avoid the iOS fixed-attachment rendering bug.
- **Defensive null checks in JS dropped.** Per CLAUDE.md ("Don't add error handling for scenarios that can't happen"), the script trusts that `#hero-card`, `#floating-avatar`, `#scroll-indicator`, and `#about` exist — they're all defined in the same file.
- **Hero blockquote uses Einstein's "out of clutter, find simplicity" line.** Lifted from the legacy site visible in `docs/brand/legacy_reference.png` rather than invented placeholder copy. Plausible as a stand-in until final copy lands.
- **Scroll-indicator fade added post-review.** User feedback after the implementation pass: the indicator should fade as the page scrolls. Implemented with a passive scroll listener tying `style.opacity` to `window.scrollY / 200`. No CSS transition on opacity — the handler runs each frame so the fade is continuous.

## Commits

```
65aa96b feat(site): fade scroll indicator on scroll
b97dd99 docs: update directory structure for site assets
28b899c feat(site): wire floating avatar and scroll indicator
cb484f8 feat(site): build footer
d54faba feat(site): build projects section
7ee38a3 feat(site): build recent posts section
a565fb1 feat(site): build about section
e5b40db feat(site): build hero section
b4bd484 feat(site): scaffold landing page foundation
723bb46 docs: add session 002 plan
```

Ten commits, one per logical step of the plan plus one feedback-driven follow-up (`fade scroll indicator on scroll`). Per the CLAUDE.md session-lifecycle rule, no batching.

## What's next

- **Phase 3 — Stack finalisation.** Replace the skeleton `docker-compose.yml` and `Caddyfile` with production-ready configs and bring the stack up locally, then on the Hetzner VPS. Worth deciding before this session whether the Tailwind Play CDN stays (and CLAUDE.md updates to match) or whether a CLI build step gets introduced — currently the live site would pull `cdn.tailwindcss.com` on every page load, which is fine for traffic this small but trades fidelity to the CLAUDE.md tech-stack claim.
- **Phase 4 — Ghost theme.** Scaffold `ghost-theme/` with Handlebars templates, mirroring the post-card styling already established here.
- **Phase 5 — Operational polish.** Scripts in `scripts/` for deploy/backup, monitoring, off-box backup destination.

### Landing-page follow-ups (defer until needed)

- **Two avatar sizes** — open item from brand guidelines: production wants an 88px source for the floating retina version. Currently the same asset is used at 140px and 44px.
- **Final copy** — About paragraphs, post titles/excerpts/dates, and project entries are plausible placeholders. Real copy lands before launch.
- **Ghost integration for post cards** — open item from brand guidelines: Phase 5 evaluation of fetching from the Ghost API (JS) vs a build-time approach.
