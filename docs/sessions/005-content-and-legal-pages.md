# Session 005 — Content & Legal Pages

## What was built

The landing page is now content-complete for launch, and the site carries the three legal pages required under German law.

- Hero quote corrected to the Wheeler phrasing of "Einstein's Three Rules of Work".
- About section replaced with the final Hamburg-based copy (fullstack engineer, financial-services background, independent).
- Recent Posts rewired to fetch from the Ghost Content API on page load, rendering cards via DOM construction (not `innerHTML`) to avoid XSS from post content. Title, excerpt, published date (formatted to `MMM D, YYYY` uppercase via `Intl.DateTimeFormat`), and tag pills are mapped from the API response. The "All posts →" link points at `GHOST.GHOST_URL`.
- Posts and Projects sections always render. When posts are empty / fetch fails, the posts section shows a "Coming soon" placeholder and hides the card list + "All posts" link. The Projects section was initially removed but restored as a heading + "Coming soon" placeholder after review.
- Three standalone legal pages created at clean URLs: `site/imprint/`, `site/privacy/`, `site/disclaimer/`. Each is a self-contained HTML document that re-declares the shared Tailwind config, fonts, `@font-face`, and `::selection` style; fonts reference `../assets/fonts/TravelingTypewriter.otf`. Each page has a `← Back` link to `/`, the title as an `<h1>` with the 40px amber underline, and a footer matching the landing page — with the current page rendered as a non-linked span in `text-text` for visual distinction.
- Footer legal links on `site/index.html` wired to `/imprint/`, `/privacy/`, `/disclaimer/`. Label `Disclosure` renamed to `Disclaimer` for consistency.
- CLAUDE.md directory tree updated to list the three legal-page folders.

Caddy required no change: `file_server` with `root /srv/site` serves directory-`index.html` files automatically.

## Key decisions

- **Dynamic posts via client-side fetch, not server-rendered.** The landing page has no build step and Caddy serves static files only. A client-side fetch to Ghost's Content API keeps the architecture static-only while letting the blog be the source of truth for posts. Rendering uses `document.createElement` + `textContent` to keep user-authored fields (title, excerpt, tag names) safe from injection.
- **Always-visible sections with "Coming soon" placeholders.** The original plan hid the Posts section when empty and deleted the Projects section outright. After review, both sections stay visible so the page has enough vertical content and telegraphs what's coming. The Projects section was restored as a minimal heading + placeholder.
- **Legal pages as standalone HTML files.** Rather than introduce a templating layer for three rarely-edited pages, each page duplicates the `<head>` and footer from `index.html`. Drift risk is low; changes are intentional and easy to replicate across four files.
- **API key placeholder committed in HTML.** `CONTENT_API_KEY = 'REPLACE_WITH_CONTENT_API_KEY'` is a literal placeholder; a real key must be substituted before the site is useful. Leaving the key in client-side HTML was flagged as unsatisfactory and is deferred to a dedicated future session — Ghost Content API keys are designed to be public (read-only, scoped), but a cleaner approach (e.g. a server-side proxy endpoint or build-time templating) should be evaluated.

## Commits

- `a959950` — docs: add session 005 plan
- `cc193ce` — fix(site): correct hero quote text and attribution
- `db1e1af` — feat(site): replace about section with final copy
- `bd74c3b` — feat(site): make recent posts dynamic via Ghost Content API
- `ca66011` — feat(site): remove projects section
- `05e9e56` — feat(site): add imprint page
- `f673611` — feat(site): add privacy policy page
- `14b696e` — feat(site): add disclaimer page
- `04588c0` — feat(site): wire footer links to legal pages
- `6779c6b` — docs: update CLAUDE.md directory structure
- `1af1fa5` — feat(site): keep posts and projects sections visible with coming-soon placeholder

## What's next

- **Session 006 — Hetzner deployment.** Provision the CX23 VPS, configure firewall + backups, install Docker + Compose, bring the stack up against the real domain, and switch DNS at Gandi.
- **Address the Content API key exposure.** Evaluate proxy-via-Caddy, build-time substitution, or an accepted read-only-key model; remove `REPLACE_WITH_CONTENT_API_KEY` from the committed HTML.
- **Fill in the imprint address** (`[STREET AND NUMBER]`, `[ZIP-CODE CITY]`) before the site goes live.
- **Create the Ghost Custom Integration** in Ghost admin (local + prod separately) to obtain the Content API keys.
- **Phase 5 follow-ups** still out of scope: SEO meta tags, Open Graph images, privacy-respecting analytics integration.
