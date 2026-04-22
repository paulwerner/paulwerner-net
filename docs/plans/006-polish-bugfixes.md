# Session 006 — Polish & Bugfixes

## Context

Five UX issues discovered during manual testing of the landing page and self-hosted Ghost blog. Fixing them gets both properties to visual parity and deployable state before Session 007 (Hetzner deployment). Scope covers scrollbar styling, full-card click targets, footer unification, blog navigation, and a broken image render path.

## Issue 1 — Hide scrollbar globally

Add to `site/index.html` `<style>` block (lines 52–84) and to each legal page's `<style>` block (`site/imprint/index.html`, `site/privacy/index.html`, `site/disclaimer/index.html`):

```css
html { scrollbar-width: none; }
html::-webkit-scrollbar { display: none; }
```

Add the same rules to `ghost-theme/assets/css/theme.css` (top of file, near the `:root` block around lines 9–27).

## Issue 2 — Full-card click target

**Landing page** (`site/index.html`, card renderer at lines 231–272): change the rendered `<article>` to an `<a href="{post-url}" class="...">` wrapper carrying the existing classes (`bg-card-bg border border-border rounded-md p-6 sm:p-7 transition-all duration-300 hover:bg-inset-bg hover:border-accent block`), plus `text-decoration: none; color: inherit;` (inline style or utility equivalent). Drop the inner title `<a>`. Keep tag pills as non-link `<span>` children so they don't conflict with the outer link.

**Ghost theme** (`ghost-theme/partials/post-card.hbs`): wrap the whole card in `<a href="{{url}}" class="post-card">`; demote the title `<h3><a>` to plain `<h3>`; keep tag pills as non-link elements. Move/keep `.post-card` hover styling on the `<a>` in `theme.css` (lines 305–316) — selectors `.post-card` and `.post-card:hover` already match an `<a>` fine, but add `display: block; color: inherit; text-decoration: none;` to `.post-card`.

## Issue 3 — Unified footer + sticky footer

**3a. Ghost footer markup** (`ghost-theme/partials/footer.hbs`): replace the current minimal markup with the same three-column layout as `site/index.html` footer (lines 154–187):

- Left: legal links — Imprint, Privacy, Disclaimer — hardcoded to `http://localhost/imprint/` etc. with a comment noting production becomes `https://paulwerner.net/imprint/`.
- Center: three social SVGs copied verbatim from `site/index.html` (GitHub, Blog/book, LinkedIn), 22px, stroke-width 1.5.
- Right: `© 2026 PW` in TravelingTypewriter.

**3b. Footer styles** (`ghost-theme/assets/css/theme.css` around lines 762–797): rewrite `.site-footer` / `.site-footer__inner` to render identically to the landing footer. Use `color: var(--muted)` for idle, `color: var(--link)` on hover for social icons and legal links. Flex row, `justify-content: space-between`, `max-width: 960px`, top border `1px solid var(--border)`. Stack vertically below ~640px.

**3c. Sticky footer:**

- Legal pages (`site/imprint/`, `site/privacy/`, `site/disclaimer/index.html`): add `min-h-screen flex flex-col` to `<body>` and `flex-1` to `<main>`.
- `site/index.html`: apply the same pattern for consistency (hero already fills viewport, so no visual change expected).
- Ghost theme (`ghost-theme/assets/css/theme.css`): add `body { min-height: 100vh; display: flex; flex-direction: column; }` and `main, .site-main { flex: 1; }`. Remove the `margin-top: 96px` on `.site-footer` if it creates double spacing; keep the top border.

## Issue 4 — Blog "Home" link to main site

`ghost-theme/partials/navigation.hbs`: prepend a hardcoded `<a href="http://localhost/" class="...">Home</a>` before the `{{#foreach navigation}}` loop, with a comment noting production becomes `https://paulwerner.net/`. Keep the site-title `<a href="{{@site.url}}">` as-is (clicks stay on blog).

Manual (not committed, document in session summary): in Ghost Admin → Settings → Navigation, remove "Home" and "About" entries.

## Issue 5 — Images not rendering in blog posts

Debug task. Investigate in order:

1. Open a test post in the running blog, view source, locate an `<img>` tag, record its `src`.
2. Hit the image URL directly in a browser — does Caddy/Ghost return 200 with correct content-type?
3. If 404, `docker compose exec ghost ls /var/lib/ghost/content/images/YYYY/MM/` to confirm file on disk.
4. Check `GHOST_URL` in `.env` matches the host the browser is hitting (local dev: `http://blog.localhost`). Mismatch here produces broken `src` attributes.
5. Check `Caddyfile` — blog block should `reverse_proxy ghost:2368` unconditionally; no path-based exclusion of `/content/images/`.
6. Inspect computed styles on the `<img>` in devtools for any `display: none` / zero-dimension rule from `theme.css`.

Fix whatever the root cause turns out to be. Record the root cause and fix in the session summary.

## Critical files

- `site/index.html`
- `site/imprint/index.html`, `site/privacy/index.html`, `site/disclaimer/index.html`
- `ghost-theme/default.hbs`
- `ghost-theme/partials/post-card.hbs`
- `ghost-theme/partials/footer.hbs`
- `ghost-theme/partials/navigation.hbs`
- `ghost-theme/assets/css/theme.css`
- `.env` (read-only check for issue 5), `Caddyfile` (read-only check)

## Commit plan

Per the session prompt — one commit per logical fix, starting with `docs: add session 006 plan` after this plan is copied to `docs/plans/006-polish-bugfixes.md`. Session summary only after acceptance.

## Verification

1. Every page (landing, 3 legal, blog index, single post, tag, 404): no visible scrollbar; scroll still works.
2. Landing + Ghost index: hovering any card → pointer cursor + accent border + lifted bg; clicking anywhere on the card navigates to the post.
3. Footers on all 6+ page types visually identical: legal links | social icons | `© 2026 PW`. Ghost footer legal links open the main-site legal pages.
4. Legal pages and Ghost 404 (short content): footer anchored to viewport bottom, no floating gap.
5. Blog header shows "Home" linking to `http://localhost/`; site title still links to blog root; no "About".
6. Test post with uploaded image: image renders at full content width with 4px radius.
7. DevTools console: no errors on any page.
