# Session 004 — Ghost Theme

## Outcome

A custom Ghost 5 theme — `paulwerner` — is committed under `ghost-theme/` and active on the local blog. It carries the landing page's brand palette, type scale, post-card styling, and tag pill treatment into the blog, adds Source Serif 4 long-form prose with a 720px reading column, and ships a self-hosted Prism bundle with syntax highlighting + a copy-to-clipboard button tuned to the brand. `gscan` passes with zero errors, and the theme dev loop is a simple bind mount: edit files under `ghost-theme/`, restart Ghost or re-activate in admin, refresh the browser. No zip upload in the hot path. CLAUDE.md's directory tree and Ghost Theme Development section reflect the new reality.

## What was built

- [docs/plans/004-ghost-theme.md](../plans/004-ghost-theme.md) — plan persisted from the Claude Code plans directory
- [ghost-theme/](../../ghost-theme/) — the theme itself:
  - `package.json` — v5 engine declaration, `card_assets: true` so Ghost injects Koenig card CSS, image_size presets for responsive feature images
  - `default.hbs` — base layout with Google Fonts preconnect, theme.css + prism.css links, `{{ghost_head}}`/`{{ghost_foot}}`, nav + footer partials, Prism script immediately before the foot helper
  - `index.hbs`, `post.hbs`, `tag.hbs`, `page.hbs`, `error-404.hbs` — five content templates, each declaring `{{!< default}}`
  - `partials/` — `navigation.hbs` (site title + admin-configured nav), `footer.hbs` (imprint/privacy), `post-card.hbs` (title/excerpt/date/tag-pills, no feature image), `pagination.hbs` (Newer/Older links + page counter auto-picked up by the `{{pagination}}` helper)
  - `assets/css/theme.css` — all brand styling (tokens, typography, layout, post cards, post prose, tag page, 404, Koenig cards)
  - `assets/css/prism.css` — Prism token colors mapped to brand tokens, toolbar layout, copy-button styling with a success state in `--accent`
  - `assets/js/prism.js` — 58 KB Prism v1.29.0 bundle: core + markup/css/clike/javascript/typescript/python/bash/json/yaml/sql/markdown/go/rust/docker + toolbar + copy-to-clipboard plugins
  - `assets/fonts/TravelingTypewriter.otf` — self-hosted, loaded via `@font-face` in `theme.css`
- [docker-compose.yml](../../docker-compose.yml) — added a bind mount `./ghost-theme:/var/lib/ghost/content/themes/paulwerner` so theme edits land inside Ghost without a zip upload cycle
- [CLAUDE.md](../../CLAUDE.md) — directory tree expanded with the full `ghost-theme/` layout; Ghost Theme Development section rewritten around the bind-mount workflow and the Prism-based syntax highlighting choice
- `dist/paulwerner.zip` (gitignored) — packaged artifact for a gscan-equivalent validation upload if ever needed

## Key decisions made during implementation

- **Post cards and single posts are image-less.** The landing page "Recent Posts" design has no card images, so the Ghost card omits `{{feature_image}}` entirely — no conditional branch. The single post header is title + date + reading time + tags, no hero image either. Page templates (for things like `/about/`) do render `{{feature_image}}` since pages often lead with one.
- **Prism's built-in Toolbar + Copy-to-Clipboard plugins replace a custom `main.js`.** The session prompt listed a `main.js` for copy-to-clipboard, but Prism's own plugins satisfy the requirement without any author-written JS. Less surface area to maintain, same behavior. If the copy button later needs to diverge from Prism's default, a `main.js` is a trivial add.
- **Minimal Koenig card styling included in scope.** Not in the original prompt, but without brand-tuned `.kg-image-card`, `.kg-bookmark-card`, `.kg-callout-card`, etc., the editor's own card output would look out of place. Added image wide/full breakouts, bookmark card with accent hover, accent-bordered callouts, and a branded button card.
- **`page.hbs` added mid-session to resolve a gscan error.** Original plan skipped it (pages would fall back to `post.hbs`). gscan v5 fatals on "Not all page features are being used" — specifically `@page.show_title_and_feature_image`, the beta editor's per-page title/image toggle. Added a `page.hbs` that respects the toggle and renders a responsive srcset feature image when shown. Zero errors after.
- **`engines.ghost-api` dropped from `package.json`.** The Plan-agent pre-flight recommended including it; gscan v5 warns on its presence. `engines.ghost: ">=5.0.0"` alone is sufficient.
- **"Missing support for custom fonts" warning intentionally ignored.** gscan wants themes to expose `--gh-font-heading` / `--gh-font-body` so Ghost admins can override fonts from the admin UI. The brand specifies three fixed typefaces that define the identity; admin-level font override would break the design. Warning accepted, not an error.
- **Ghost navigation is rendered via `{{#foreach @site.navigation}}` rather than the built-in `{{navigation}}` helper.** Custom markup gives direct control over typography (TravelingTypewriter, letter-spacing, uppercase) and per-item classes including `.is-current`. The built-in helper's output would need to be overridden via the same partial path anyway, so manual iteration is the clearer route.
- **Pagination partial auto-picked up by `{{pagination}}`.** Ghost's helper looks for `partials/pagination.hbs` and uses it if present. The custom partial renders "← Newer | Page X of Y | Older →" in typewriter uppercase over a top border, using `{{page_url pagination.prev}}` / `{{page_url pagination.next}}` to build the correct URLs.
- **`<time datetime="YYYY-MM-DD">` plus CSS `text-transform: uppercase`.** Moment has no uppercase format token; the semantic date string stays clean for screen readers while the display is styled via CSS. The machine-readable `datetime` attribute matches the landing page pattern.
- **Scope expansion for the bind mount.** Original plan explicitly deferred a bind mount to a future session ("if zip-upload friction becomes painful"). At review checkpoint, the user surfaced that friction immediately and proposed baking the theme into the image; bind-mount is the simpler alternative that also matches production naturally. One line in `docker-compose.yml`, two commits to land it and correct a docs wording slip.
- **Mount landed as read-write, not read-only.** The first attempt used `:ro` per the Ghost-docs default. Ghost's entrypoint chowns everything under `content/` on boot as part of its permissions handling and exits 1 if the chown fails on a read-only mount. Dropped `:ro`; Ghost doesn't actually write to the theme tree, so the source files stay untouched.
- **Two docs commits that weren't in the plan.** `docs: add session 004 plan` before implementation (matches the Session 003 pattern) and `fix: resolve gscan findings in ghost theme` after discovering the `page.hbs` requirement. Neither bundled into a feature commit.

## Commits

```
67c41a5 docs: correct CLAUDE.md theme mount note to reflect rw mount
b270885 feat: bind-mount ghost-theme directory into ghost container
6d5f1cf fix: resolve gscan findings in ghost theme
1b0cc0a docs: update CLAUDE.md directory structure
415c0c4 feat: add 404 page
2fe0f10 feat: add tag page
51e5fe9 feat: style Koenig editor cards
f655ad6 feat: bundle Prism and style code blocks
7c4138c feat: add single post layout and prose styles
19cba5e feat: add pagination partial
fe16fed feat: add post card partial and index page
a7c2cbc feat: add navigation and footer partials
e0b1025 feat: add base typography and global styles to ghost theme
232ad92 feat: scaffold ghost theme skeleton
17b918b docs: add session 004 plan
```

Fifteen commits: the plan, eleven implementation steps, one gscan fix, two bind-mount commits, one follow-up doc fix. One commit per logical unit per the session-lifecycle rule.

## What's next

- **Write the first real posts.** The theme now has places to show prose, code blocks, tag pills, and pagination, but nothing is actually there yet. Seeding three or four real posts will be the first real test of the reading experience at the sizes and spacings that were designed against placeholder content.
- **Phase 5 — operational polish + Hetzner deployment.** Scripts for deploy/backup, off-box backup destination, Ghost HTTP healthcheck (deferred from Session 003), resource limits, a real SMTP provider for Ghost mail, and the first `docker compose up` on the Hetzner VPS. The bind-mount approach means production will pull the theme via `git pull` + `docker compose restart ghost` rather than an admin upload — same workflow, different environment.

### Theme follow-ups (defer until needed)

- **Theme screenshots.** `assets/screenshot-desktop.jpg` and `assets/screenshot-mobile.jpg` give the admin theme-switcher a proper preview; gscan warns without them but does not error. Add once the design has real content to screenshot.
- **Custom fonts support.** The `--gh-font-heading` / `--gh-font-body` gscan warning is intentionally open. If a future brand iteration wants admin-overridable fonts, re-plumb the CSS so those variables drive body/heading typography with brand fonts as the default.
- **`main.js` for richer interactivity.** Currently no custom JS — Prism's plugins handle code-block UX. If something needs wiring later (reading-progress bar, scroll-aware nav, copy-link-to-heading), that's where it goes.
- **Author page.** Out of scope here; Ghost falls back to `index.hbs` for `/author/...` routes. Fine for a single-author blog; revisit if that changes.
- **Refine Koenig card styling with real posts.** The current styles are defensively complete but not verified against every card variant. The first time a post uses an embed or gallery card, re-tune if needed.
