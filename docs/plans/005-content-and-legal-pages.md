# Session 005 — Content & Legal Pages

## Context

The landing page currently ships with placeholder copy, three hardcoded post cards, a projects section that will not appear on the launched site, and footer legal links pointing at `#`. The blog (Ghost) is running locally and will be the source of truth for posts. Before deployment (next session), the site must be content-complete: real copy, live post feed, no stale/invented projects, and the three legal pages German law requires (Impressum, Privacy, Disclaimer). This session closes all of that.

Out of scope: Hetzner deployment, SEO/OG tags, analytics integration, Ghost theme changes, `docker-compose.yml`, `Caddyfile`.

## Critical files

- `site/index.html` — all five tasks touch this file
- `site/imprint/index.html` — new
- `site/privacy/index.html` — new
- `site/disclaimer/index.html` — new
- `CLAUDE.md` — directory-tree update
- `docs/plans/005-content-and-legal-pages.md` — copy of this plan after approval
- `docs/sessions/005-content-and-legal-pages.md` — summary, written only after acceptance

No Caddyfile change needed: `file_server` with `root /srv/site` serves `/imprint/`, `/privacy/`, `/disclaimer/` automatically via the directory `index.html` convention.

## Implementation steps (one commit per step, per CLAUDE.md workflow)

1. **`docs: add session 005 plan`** — copy this plan to `docs/plans/005-content-and-legal-pages.md`.

2. **`fix(site): correct hero quote text and attribution`** — `site/index.html:106-109`:
   - Blockquote → `"Einstein's Three Rules of Work: Out of clutter find simplicity. From discord find harmony. In the middle of difficulty lies opportunity."`
   - Cite → `— John Archibald Wheeler`

3. **`feat(site): replace about section with final copy`** — replace both `<p>` elements in `site/index.html:123-126` with the two-paragraph final copy from the session prompt. No markup/style changes.

4. **`feat(site): make recent posts dynamic via Ghost Content API`**
   - Remove the three static `<article>` blocks inside `#posts` (`site/index.html:134-168`); leave the container `<div class="flex flex-col gap-4 mt-12">` empty with an `id="posts-list"`.
   - Add `id="posts-section"` to `<section id="posts">` so it can be hidden as a unit.
   - Update "ALL POSTS →" `<a href>` to the config blog URL (`site/index.html:173`).
   - Append a new `<script>` block (after the existing one) that:
     - Defines a config object at the top with `GHOST_URL` and `CONTENT_API_KEY`. Add a comment: these values differ between local (`http://blog.localhost`, local integration key) and production (`https://blog.paulwerner.net`, prod integration key).
     - Fetches `${GHOST_URL}/ghost/api/content/posts/?key=${KEY}&limit=3&fields=title,slug,url,excerpt,published_at&include=tags`.
     - On failure, empty `posts` array, or network error → sets `posts-section` `hidden` attribute; returns silently. No console error noise beyond the browser's default fetch error.
     - On success, renders cards using the same Tailwind classes as the removed statics. Title/excerpt/date/tags mapped from API response. Date formatted to `MMM D, YYYY` uppercase via `Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })` then uppercased (matches "APR 22, 2026"). `<time datetime>` uses ISO date. Tag pills iterate `post.tags` (use `tag.name`, lowercase for visual parity). Card `<a href>` → `post.url` (full URL from Ghost).
     - Escapes user-supplied strings before insertion (title, excerpt, tag names) — use `textContent` / DOM construction, not template-literal `innerHTML`, to avoid XSS from post content.
   - Creating the Ghost Content API integration is a one-time manual admin step the implementer performs out-of-band; the key goes into the config object. Note this in the session summary so it's remembered when provisioning production.

5. **`feat(site): remove projects section`** — delete the entire `<section id="projects">` block (`site/index.html:182-213`). No commented-out remnants.

6. **`feat(site): add imprint page`** — `site/imprint/index.html`. Shared page shell (see §Shared legal-page shell below). Content: the DDG §5 block from the prompt, verbatim, with `[STREET AND NUMBER]` / `[ZIP-CODE CITY]` kept as literal placeholders.

7. **`feat(site): add privacy policy page`** — `site/privacy/index.html`. Shell + the Privacy Policy text from the prompt. `[DATE]` → `2026-04-22`.

8. **`feat(site): add disclaimer page`** — `site/disclaimer/index.html`. Shell + the Disclaimer text from the prompt. `[DATE]` → `2026-04-22`.

9. **`feat(site): wire footer links to legal pages`** — update `site/index.html:219-223` so `Imprint` → `/imprint/`, `Privacy` → `/privacy/`, `Disclosure` → `/disclaimer/` (also rename label `Disclosure` → `Disclaimer` for consistency with the page title). Each legal page's footer marks its own link by swapping `text-muted hover:text-link` for `text-text` and dropping the `<a>` (or leaving as a non-link span) so the current page is visually distinguished.

10. **`docs: update CLAUDE.md directory structure`** — extend the `site/` tree in CLAUDE.md with `imprint/index.html`, `privacy/index.html`, `disclaimer/index.html`. No mention of the removed projects section is needed since the tree never listed inline sections.

11. Review checkpoint with the user.

12. **`docs: add session 005 summary`** — only after acceptance, at `docs/sessions/005-content-and-legal-pages.md`.

### Shared legal-page shell

Each legal page is a standalone HTML doc to avoid introducing a templating layer. To keep them in sync, every legal page uses the same `<head>` as `site/index.html` (copy verbatim: Tailwind CDN + `tailwind.config` block, Google Fonts `<link>`, `@font-face` for TravelingTypewriter, `::selection` style). Skip `.hero-bg` / `.hero-grain` styles — legal pages don't need them.

Body structure:

```
<body class="bg-bg text-text font-serif antialiased">
  <main class="max-w-[720px] mx-auto px-6 py-12">
    <a href="/" class="font-typewriter text-[14px] uppercase tracking-[1.5px] text-link hover:text-hover …">← Back</a>

    <h1 class="font-typewriter text-[28px] tracking-[2px] uppercase mt-8">{Title}</h1>
    <span class="block w-10 h-0.5 bg-accent mt-2" aria-hidden="true"></span>

    <div class="mt-10 font-serif text-[17px] leading-[1.8]">
      <!-- h2/h3 in Source Serif 4 semibold; paragraphs preserve prompt line breaks -->
    </div>
  </main>

  <footer class="max-w-[960px] mx-auto border-t border-border px-6 py-8">
    <!-- same footer markup as index.html, with this page's link rendered as
         a non-linked span in text-text -->
  </footer>
</body>
```

Font assets (`assets/fonts/TravelingTypewriter.otf`, `assets/avatar_small.png`, `assets/background.png`) are referenced by relative path from `site/` — legal pages live one directory deeper, so their `@font-face` `url()` must be `../assets/fonts/TravelingTypewriter.otf`. No image assets are needed on the legal pages.

Email obfuscation: the imprint shows `contact(at)paulwerner.net` as plain text per the prompt (intentional — no `mailto:`).

## Reused utilities / patterns

- Tailwind config, color tokens, font stack: copy verbatim from `site/index.html:14-50` — do not drift from the canonical values.
- Post-card markup classes: copy from the removed static `<article>` blocks so the dynamic renderer produces byte-identical cards for a given post.
- Footer markup (nav + social + copyright): copy from `site/index.html:216-248`.
- Date formatting via `Intl.DateTimeFormat` (no library).

## Verification

1. `docker compose up -d` running; `http://localhost/` loads — hero shows Wheeler quote, about shows final copy, no projects section.
2. With zero published posts in Ghost: the posts section is fully hidden (no heading, no empty state). Page flows hero → about → footer.
3. Stop Ghost (`docker compose stop ghost`), reload `http://localhost/` — posts section still hidden, no console error breaks the page, the rest of the site renders.
4. Start Ghost, publish one post with at least one tag, reload — posts section appears, card shows real title/excerpt/date/tag pill, clicking title opens the Ghost post URL, "ALL POSTS →" opens `http://blog.localhost`.
5. Visit `/imprint/`, `/privacy/`, `/disclaimer/` — each renders branded, shows its content, has a working `← Back` link to `/`, and in its footer the current page is shown un-linked in `text-text` while the other two legal links work.
6. Footer on `site/index.html` — Imprint/Privacy/Disclaimer links navigate correctly.
7. DevTools responsive at 375/768/1280 px — legal pages and dynamic posts section behave correctly; no horizontal scroll.
8. DevTools console on all four pages — no errors.
