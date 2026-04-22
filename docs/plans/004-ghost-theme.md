# 004 — Ghost Theme

## Context

The local stack from session 003 runs a functional Ghost instance at `http://blog.localhost`, but Ghost still serves its default Casper theme. The brand identity established on the landing page (session 002) needs to carry into the blog reading experience so the two properties feel like one. This session builds a custom Ghost 5 theme — `paulwerner` — that mirrors the landing page's color palette, typography, post-card styling, and tag pill treatment, plus adds proper typography and syntax-highlighted code blocks for technical posts. Scope is deliberately tight: four content templates, a default layout, partials, a single CSS file, and a bundled Prism. No membership, newsletter, author pages, or custom page templates.

## Approach

The theme lives in a new top-level `ghost-theme/` directory. Styling is plain CSS with CSS custom properties at `:root` — the brand tokens match the landing page exactly so the two codebases share one visual contract. Layout is mobile-first with a single `640px` breakpoint, matching the landing page. Syntax highlighting uses a self-hosted Prism bundle (core + selected languages + toolbar + copy-to-clipboard plugins) with a brand-tuned `prism.css`. Because Prism ships its own copy-to-clipboard plugin, no custom JS is needed — this is a deliberate simplification from the session prompt's `main.js` deliverable. Feature images are skipped on post cards (matches the landing page; posts will appear image-less on the index). TravelingTypewriter is bundled as an `.otf`; Source Serif 4 and JetBrains Mono load from Google Fonts. The dev workflow is zip-upload via Ghost admin per session 003's design — no docker-compose changes.

## Theme structure

```
ghost-theme/
├── assets/
│   ├── css/
│   │   ├── theme.css
│   │   └── prism.css
│   ├── js/
│   │   └── prism.js
│   └── fonts/
│       └── TravelingTypewriter.otf
├── partials/
│   ├── navigation.hbs
│   ├── footer.hbs
│   ├── post-card.hbs
│   └── pagination.hbs
├── default.hbs
├── index.hbs
├── post.hbs
├── tag.hbs
├── error-404.hbs
└── package.json
```

## Key decisions

- **No custom `main.js`.** Prism's Toolbar + Copy-to-Clipboard plugins satisfy the "copy button on code blocks" requirement in the prompt without authoring custom JS. Cleaner, less surface area. If the button's behavior later needs to diverge from Prism's plugin, a `main.js` can be added trivially.
- **Prism bundle contents.** Core + languages: `javascript`, `typescript`, `python`, `bash`, `json`, `yaml`, `markup` (HTML), `css`, `sql`, `docker`, `markdown`, `go`, `rust`. Plugins: `toolbar`, `copy-to-clipboard`. No theme (brand-tuned `prism.css` is authored from scratch).
- **Post cards are image-less.** Matches the landing page's "Recent Posts" cards. No `{{#if feature_image}}` branch. Feature images on the single post page are also skipped for this session — the page header is title + meta line only.
- **Minimal Koenig card styling.** Ghost's editor emits `.kg-image-card`, `.kg-bookmark-card`, `.kg-embed-card`, `.kg-callout-card`, and a few others. The theme sets `card_assets: true` in `package.json` so Ghost injects default card CSS, and overrides only the bits that clash with the brand (image wide/full widths, bookmark card colors). Fully custom card styling is out of scope.
- **Error template is `error-404.hbs` only.** Ghost falls back to a bare template for other error codes; that's acceptable for this scope.
- **Theme name is `paulwerner`.** Directory name, `package.json` name, zip root folder — all `paulwerner`. No dots, no hyphens.
- **Body classes drive per-template layout.** `.post-template main { max-width: 720px; }` and similar, rather than per-template inline styles. Uses the `{{body_class}}` output already planned.
- **No bind mount for theme source.** Session 003's named-volume design stands; iteration is zip → upload → reload. If that friction becomes painful, a future session can add a bind mount — not this one.

## Implementation steps

Each step is a commit.

### 1. Theme skeleton that renders

- Create `ghost-theme/` with the full directory tree shown above.
- Write `package.json` with: `name: "paulwerner"`, `version: "0.1.0"`, `description`, `author.email: "tech@paulwerner.net"`, `license: "MIT"`, `engines: { "ghost": ">=5.0.0", "ghost-api": "v5" }`, `config: { "posts_per_page": 10, "card_assets": true, "image_sizes": {...} }`, `keywords: ["ghost-theme"]`.
- Copy `site/assets/fonts/TravelingTypewriter.otf` → `ghost-theme/assets/fonts/TravelingTypewriter.otf`.
- Write `default.hbs` with full `<!doctype html>`, `<head>` (meta viewport, preconnect for Google Fonts, Google Fonts `<link>` for Source Serif 4 400/600/700 + JetBrains Mono 400/500, `<link rel="stylesheet" href="{{asset "css/theme.css"}}">`, `<link rel="stylesheet" href="{{asset "css/prism.css"}}">`, `{{ghost_head}}`), `<body class="{{body_class}}">` with `{{> "navigation"}}` → `<main>{{{body}}}</main>` → `{{> "footer"}}` → `<script src="{{asset "js/prism.js"}}"></script>` → `{{ghost_foot}}` → `</body>`.
- Write minimal `index.hbs` with `{{!< default}}` at top, then `{{#foreach posts}}<article><h2><a href="{{url}}">{{title}}</a></h2></article>{{/foreach}}` — just enough to verify posts render.
- Write minimal `post.hbs` with `{{!< default}}`, then `{{#post}}<article class="{{post_class}}"><h1>{{title}}</h1>{{content}}</article>{{/post}}`.
- Write minimal `tag.hbs` with `{{!< default}}`, `{{#tag}}<h1>{{name}}</h1>{{/tag}}`, `{{#foreach posts}}<h2>{{title}}</h2>{{/foreach}}`.
- Write minimal `error-404.hbs` with `{{!< default}}` and a placeholder heading.
- Write stub `partials/navigation.hbs`, `partials/footer.hbs`, `partials/post-card.hbs`, `partials/pagination.hbs`.
- Write `theme.css` with only CSS custom properties at `:root` (every token from the visual spec) and `@font-face` for TravelingTypewriter loading `{{asset "fonts/TravelingTypewriter.otf"}}`. (Note: in CSS served from `/assets/css/theme.css`, the `@font-face` URL is relative — `url("../fonts/TravelingTypewriter.otf") format("opentype")`.)
- Write empty-ish `prism.css` (just a `/* styled in step 7 */` comment) and `prism.js` (one-line placeholder, replaced in step 7).

Acceptance: zip `ghost-theme/paulwerner/*` → upload to `http://blog.localhost/ghost/#/settings/design` → activate → home page renders without gscan errors; posts visible as bare `<h2>` links.

### 2. Typography and global styles in `theme.css`

- `html, body`: `background: var(--bg)`, `color: var(--text)`, `font-family: 'Source Serif 4', Georgia, serif`, `font-size: 17px`, `line-height: 1.8`, `-webkit-font-smoothing: antialiased`.
- `::selection`: `background: var(--accent)`, `color: var(--bg)`.
- Links: default `--link`, hover `--hover`, visited `--gold`, active `--accent`, `text-decoration: none`, `transition: color 0.2s ease`.
- Focus outlines: `2px solid var(--accent)`, `outline-offset: 2px`, `border-radius: 2px` on all interactive elements.
- Headings `h1..h6`: Source Serif 4; sizes and weights per the visual spec (h1 36/700, h2 24/700, h3 20/600, h4..h6 16/600); `line-height: 1.2`.
- Inline `code`: JetBrains Mono, 14px, color `--link`, background `--inset-bg`, padding `2px 4px`, border-radius 2px.
- Responsive container: `main { max-width: 720px; margin: 0 auto; padding: 0 24px; }`. Per-body-class overrides later.
- `prefers-reduced-motion: reduce` — disable transitions.

Acceptance: typography is legible, links cycle through state colors, selection highlights in amber.

### 3. Navigation and footer partials

- `partials/navigation.hbs`: `<header class="site-header">` → site title link to `{{@site.url}}` using TravelingTypewriter → then `{{#if @site.navigation}}<nav aria-label="Primary"><ul>{{#foreach navigation}}<li><a href="{{url}}" class="{{#if current}}is-current{{/if}}">{{label}}</a></li>{{/foreach}}</ul></nav>{{/if}}`.
- `partials/footer.hbs`: `<footer class="site-footer">` → `© {{@site.title}}` plus "Imprint" / "Privacy" links (hardcoded paths for now: `/imprint/` and `/privacy/` — Ghost admin will likely route these to the landing page) → TravelingTypewriter 13px, color `--muted`, hover `--link`, top border 1px solid `--border`.
- Styles in `theme.css`: header layout (flex row, space-between on desktop, stacked on mobile), link styling per the landing page pattern.

Acceptance: header shows site title and admin-configured nav (if any); footer renders with brand tokens.

### 4. Post card partial and index

- `partials/post-card.hbs`: `<article class="post-card"><h3 class="post-card__title"><a href="{{url}}">{{title}}</a></h3><p class="post-card__excerpt">{{excerpt words="30"}}</p><div class="post-card__meta"><time datetime="{{date format="YYYY-MM-DD"}}" class="post-date">{{date format="MMM D, YYYY"}}</time>{{#if tags}}<ul class="post-card__tags">{{#foreach tags}}<li class="tag-pill">{{name}}</li>{{/foreach}}</ul>{{/if}}</div></article>`.
- Rewrite `index.hbs`: `{{!< default}}` → `<div class="posts">{{#foreach posts}}{{> "post-card"}}{{/foreach}}</div>{{> "pagination"}}`.
- Styles in `theme.css`:
  - `.post-card`: bg `--card-bg`, border 1px solid `--border`, border-radius 6px, padding 28px (24px on mobile), transition `all 0.3s ease`. Hover: bg `--inset-bg`, border `--accent`.
  - `.post-card__title`: Source Serif 4 20px/600, line-height 1.35, color `--text`. Link inherits; hover `--link`.
  - `.post-card__excerpt`: 15px/400, color `--muted`, line-height 1.6, margin-top 8px.
  - `.post-card__meta`: flex row, gap 16px, margin-top 16px, align-items center, flex-wrap wrap.
  - `.post-date`: TravelingTypewriter 11px, letter-spacing 1.5px, color `--muted`, `text-transform: uppercase`.
  - `.post-card__tags`: flex row, gap 8px, list-style none, padding 0, margin 0.
  - `.tag-pill`: TravelingTypewriter 12px, color `--accent`, border 1px solid `--border`, border-radius 3px, padding 2px 10px, letter-spacing 0.5px, background transparent.
  - `.posts`: flex column, gap 16px.
- Max-width for the home index: `.home-template main, .tag-template main, .paged main { max-width: 780px; }` — slightly wider than post body, matches landing page Recent Posts width.

Acceptance: home page shows stacked post cards with correct hover behavior and tag pills; visual diff against landing page cards is negligible.

### 5. Pagination partial

- `partials/pagination.hbs`: guarded with `{{#if pagination.pages}}`, render `<nav class="pagination" aria-label="Pagination">` with `prev` link ("← Newer"), page counter ("Page X of Y"), `next` link ("Older →"). Use `{{page_url pagination.prev}}` / `{{page_url pagination.next}}`.
- Styles: flex row, space-between, margin-top 48px, padding-top 24px, border-top 1px solid `--border`, all labels TravelingTypewriter 13px, letter-spacing 1px, uppercase. Disabled/absent state: if no prev, render an empty `<span>` to preserve layout.

Acceptance: pagination renders at the bottom of the home page when there are enough posts (create two pages' worth in Ghost admin to verify).

### 6. Post layout and prose styles

- Rewrite `post.hbs`:
  ```hbs
  {{!< default}}
  {{#post}}
  <article class="{{post_class}} post">
    <header class="post__header">
      <h1 class="post__title">{{title}}</h1>
      <div class="post__meta">
        <time datetime="{{date format="YYYY-MM-DD"}}" class="post-date">{{date format="MMM D, YYYY"}}</time>
        {{#if reading_time}}<span class="post__reading-time">{{reading_time}}</span>{{/if}}
        {{#if tags}}<ul class="post__tags">{{#foreach tags}}<li class="tag-pill"><a href="{{url}}">{{name}}</a></li>{{/foreach}}</ul>{{/if}}
      </div>
    </header>
    <div class="post-content">{{content}}</div>
    <nav class="post__nav" aria-label="Post navigation">
      <a href="/">← Back to posts</a>
    </nav>
  </article>
  {{/post}}
  ```
- Styles in `theme.css` (prose block):
  - `.post-template main { max-width: 720px; }`.
  - `.post__title`: Source Serif 4 36/700, margin-bottom 16px.
  - `.post__meta`: flex row wrap, gap 16px, margin-bottom 40px. Reading-time and date use TravelingTypewriter typography.
  - `.post-content p`: 17px/1.8, margin 0 0 1.5em, color `--text`.
  - `.post-content h2`: margin-top 2.5em, margin-bottom 0.5em.
  - `.post-content h3, h4, h5, h6`: similar smaller margins.
  - `.post-content a`: `--link` with hover `--hover` and `text-decoration: underline`, `text-underline-offset: 0.2em`, `text-decoration-color: var(--border)` hover `var(--accent)`.
  - `.post-content ul, ol`: padding-left 1.5em, `li` margin-bottom 0.5em.
  - `.post-content blockquote`: border-left 3px solid `--accent`, padding-left 1.5em, margin 1.5em 0, color `--muted`, font-style italic.
  - `.post-content hr`: border none, border-top 1px solid `--border`, margin 2em 0.
  - `.post-content img`: max-width 100%, height auto, border-radius 4px.
  - `.post__nav`: margin-top 64px, padding-top 24px, border-top 1px solid `--border`, TravelingTypewriter 14px uppercase link styling.

Acceptance: create a test post with paragraphs, headings, a blockquote, a list, and an `hr`. Reading experience matches the target: Source Serif 4 body, 1.8 line-height, 720px max-width, accent-colored blockquote border.

### 7. Prism bundle and code-block styling

- Download Prism from prismjs.com/download.html with:
  - Compression: Minified
  - Theme: None
  - Languages: javascript, typescript, python, bash, json, yaml, markup, css, sql, docker, markdown, go, rust
  - Plugins: Toolbar, Copy to Clipboard Button
- Save as `ghost-theme/assets/js/prism.js` (single file).
- Write `ghost-theme/assets/css/prism.css` from scratch:
  - Base token colors tuned to the brand: comments `--muted`, keywords/operators `--accent`, strings `--link`, numbers `--gold`, functions/class-names `--hover`, punctuation `--text`.
  - `pre[class*="language-"]`: background `--inset-bg`, color `--text`, padding 16px, border-radius 4px, border 1px solid `--border`, font-family JetBrains Mono, font-size 14px, line-height 1.5, overflow-x auto.
  - `code[class*="language-"]`: inherit font/size/color; no background (the `pre` carries it).
  - Inline `code`: NOT affected by these selectors (they require `language-*` class).
  - Toolbar plugin styling: `.code-toolbar > .toolbar` positioned top-right, fades in on `pre:hover`. Toolbar buttons: TravelingTypewriter 12px, color `--muted`, background transparent, border 1px solid `--border`, border-radius 3px, padding 2px 10px, hover color `--link` and border `--accent`. Success state (after copy): color `--accent`.
- Styles in `theme.css`: any final adjustments to ensure `.post-content pre` has margin 1.5em 0 for breathing room.
- Verify `default.hbs` script order: `prism.js` before `{{ghost_foot}}`, both before `</body>`.

Acceptance: create a test post with code blocks in three languages (JavaScript, Bash, TypeScript). Verify syntax highlighting matches brand palette, copy button appears top-right on hover, clicking the button copies code and shows "Copied" feedback.

### 8. Koenig card minimal styling

- In `theme.css`, add:
  - `.kg-card`: margin 1.5em 0.
  - `.kg-width-wide`: max-width calc(100% + 120px), margin-left -60px, margin-right -60px (constrained on mobile via `@media (max-width: 760px) { margin-left: 0; margin-right: 0; }`).
  - `.kg-width-full`: full viewport width breakout (`width: 100vw`, `margin-left: calc(50% - 50vw)`).
  - `.kg-image-card img`: border-radius 4px.
  - `.kg-bookmark-card`: bg `--card-bg`, border 1px solid `--border`, border-radius 6px, hover border `--accent`. `.kg-bookmark-title` Source Serif 4 semibold `--text`. `.kg-bookmark-description` color `--muted`.
  - `.kg-callout-card`: bg `--inset-bg`, border-left 3px solid `--accent`, padding 16px 20px.
  - `.kg-embed-card iframe, .kg-embed-card video`: max-width 100%.

Acceptance: create a post with an image card, a bookmark card, and a callout card. All render in brand style without visual regressions.

### 9. Tag page

- Expand `tag.hbs`:
  ```hbs
  {{!< default}}
  <section class="tag-header">
    {{#tag}}
    <h1 class="tag-header__name">{{name}}</h1>
    {{#if description}}<p class="tag-header__description">{{description}}</p>{{/if}}
    {{/tag}}
  </section>
  <div class="posts">
    {{#foreach posts}}{{> "post-card"}}{{/foreach}}
  </div>
  {{> "pagination"}}
  ```
- Styles: `.tag-header` center-aligned or left-aligned per brand (centered matches the landing page section-heading treatment — use TravelingTypewriter 28px with 40×2px `--accent` bar pseudo-element below, 40px margin above posts list).

Acceptance: add two tags in Ghost admin, tag one post with each, verify `/tag/tag-name/` routes render correctly with filtered posts.

### 10. 404 page

- Expand `error-404.hbs`:
  ```hbs
  {{!< default}}
  <section class="error">
    <h1 class="error__code">404</h1>
    <p class="error__message">This page doesn't exist.</p>
    <a href="/" class="error__link">← Back to writing</a>
  </section>
  ```
- Styles: `.error` centered, `min-height: 60vh`, flex column center. `.error__code` Source Serif 4 120/700, color `--accent`, letter-spacing -2px. `.error__message` 17px `--muted`. `.error__link` TravelingTypewriter 14px uppercase, `--link`/`--hover`.

Acceptance: visit `http://blog.localhost/does-not-exist/`, see branded 404 page.

### 11. Update `CLAUDE.md`

- Add `ghost-theme/` to the directory structure tree in `CLAUDE.md`, reflecting the full layout shipped in this session.
- The "Ghost Theme Development" section can reference that the theme is Prism-based (note Prism bundle + plugins). Keep this concise — two-line addition max, or skip if the existing section covers it.
- Do NOT update the `scripts/` placeholder note; that's for a later session.

Acceptance: `CLAUDE.md` directory tree matches repo reality after the session.

## Verify

Execute in order after implementation is complete:

1. **Local stack running.** `docker compose ps` shows all three services healthy. Ghost reachable at `http://blog.localhost`.
2. **gscan passes.** Optionally run `npx gscan ghost-theme/` from the repo root (or inside a temporary checkout); expect 0 errors, warnings only on optional items (screenshots).
3. **Zip packaging.** Create `paulwerner.zip` containing the `ghost-theme/` contents with `paulwerner/` as the top-level folder inside the zip. (On Windows: rename `ghost-theme/` → `paulwerner/` temporarily or copy contents, then zip; or use `cd ghost-theme && zip -r ../paulwerner.zip .` with Git Bash and let the zip have no top-level folder — Ghost accepts both formats in v5.)
4. **Upload and activate.** At `http://blog.localhost/ghost/#/settings/design`, upload the zip, click Activate. No errors surface in the UI.
5. **Seed test content.** In Ghost admin, create:
   - Two test posts: one with headings, paragraphs, a blockquote, a list, a link, an image card; another with three fenced code blocks in JavaScript, Bash, and TypeScript.
   - Two tags: `infrastructure`, `writing`. Tag the first post with both, the second with `infrastructure` only.
   - Set `posts_per_page` low (in `package.json`) or add enough posts to trigger pagination — drop to `"posts_per_page": 2` temporarily if needed.
6. **Home page.** Load `http://blog.localhost/`. Verify: post cards match landing page styling (bg, border, padding, hover), tag pills render, dates display in uppercase "Mar DD, YYYY", excerpt appears, pagination shows at bottom.
7. **Single post.** Click a post title. Verify: max-width 720px, Source Serif 4 body at 1.8 line-height, post-meta line shows date + reading time + tags, "Back to posts" link at bottom.
8. **Code blocks.** Navigate to the code-heavy test post. Verify: each `pre` has `--inset-bg` background, syntax colors match brand palette, hover reveals a "Copy" button, clicking copies to clipboard and shows "Copied" feedback for ~1.5s.
9. **Tag page.** Visit `/tag/infrastructure/`. Verify: heading shows tag name, filtered posts list renders, pagination appears if applicable.
10. **404 page.** Visit `/not-a-real-path/`. Verify: branded 404 with centered layout.
11. **Responsive.** Resize browser to 375px, 768px, 1280px. Verify: header collapses appropriately, cards and post content stay readable, code blocks scroll horizontally without breaking layout, no horizontal page scroll.
12. **Fonts loaded.** Open DevTools → Network → filter fonts. Verify: TravelingTypewriter loads from the Ghost origin, Source Serif 4 and JetBrains Mono load from `fonts.gstatic.com`.
13. **Cross-check landing page.** Open `http://localhost` (landing page) and `http://blog.localhost` (blog) side-by-side. Colors, typography, card styling, tag pills should feel indistinguishable.

## Critical files

| Path | Action |
|------|--------|
| `ghost-theme/package.json` | Create |
| `ghost-theme/default.hbs` | Create |
| `ghost-theme/index.hbs` | Create |
| `ghost-theme/post.hbs` | Create |
| `ghost-theme/tag.hbs` | Create |
| `ghost-theme/error-404.hbs` | Create |
| `ghost-theme/partials/navigation.hbs` | Create |
| `ghost-theme/partials/footer.hbs` | Create |
| `ghost-theme/partials/post-card.hbs` | Create |
| `ghost-theme/partials/pagination.hbs` | Create |
| `ghost-theme/assets/css/theme.css` | Create |
| `ghost-theme/assets/css/prism.css` | Create |
| `ghost-theme/assets/js/prism.js` | Create (downloaded from prismjs.com) |
| `ghost-theme/assets/fonts/TravelingTypewriter.otf` | Copy from `site/assets/fonts/` |
| `CLAUDE.md` | Edit (directory structure) |

## Reused references

- `site/index.html:1-400` — post card markup, tag pill styling, date formatting pattern (exact values to mirror).
- `docs/brand/brand-guidelines.md` — full type scale, color palette, "Ghost Theme Direction" section at the bottom.
- `docker-compose.yml:22` — Ghost service config (ghost:5-alpine, named volume `ghost_content`).
- `Caddyfile:9` — `reverse_proxy ghost:2368` confirms the target.
- `docs/plans/003-local-stack.md` and `docs/sessions/003-local-stack.md` — commit conventions and zip-upload workflow.

## Commit plan

One commit per step above:

1. `feat: scaffold ghost theme skeleton`
2. `feat: add base typography and global styles to ghost theme`
3. `feat: add navigation and footer partials`
4. `feat: add post card partial and index page`
5. `feat: add pagination partial`
6. `feat: add single post layout and prose styles`
7. `feat: bundle Prism and style code blocks`
8. `feat: style Koenig editor cards`
9. `feat: add tag page`
10. `feat: add 404 page`
11. `docs: update CLAUDE.md directory structure`

Session summary (`docs/sessions/004-ghost-theme.md`) is NOT committed as part of the implementation sequence — per CLAUDE.md's session lifecycle, it's written only after the implementation is accepted.

## Out of scope / deferred

- **Author page** — Ghost will fall back to `index.hbs` for `/author/*` routes. Fine for a single-author blog.
- **Custom page template** — Ghost falls back to `post.hbs` for pages. If the blog later needs `/about/`, a `page.hbs` can be added.
- **Membership / subscribe UI** — not wired.
- **Newsletter template** — not wired.
- **Dev bind mount** (`./ghost-theme/:/var/lib/ghost/content/themes/paulwerner`) — if zip-upload friction becomes painful, a future session adds this. Not this session.
- **Theme screenshots** (`assets/screenshot-desktop.jpg`, `assets/screenshot-mobile.jpg`) — gscan warns without them; optional polish, add when visuals are stable.
- **Session summary** `docs/sessions/004-ghost-theme.md` — written after acceptance, not during implementation.
