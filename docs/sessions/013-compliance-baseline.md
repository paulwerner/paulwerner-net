# 013 — Compliance baseline

**Plan:** [docs/plans/013-compliance-baseline.md](../plans/013-compliance-baseline.md)
**Branch:** `claude/portfolio-compliance-baseline-xfrok4` → PR #2

## Why

The site is being repositioned as a portfolio selling DSGVO/BFSG compliance to German SMEs, and it violated the standard it was going to sell. All four pages loaded Google Fonts from two origins plus the Tailwind Play CDN — three third parties receiving every visitor's IP with no legal basis and no consent — while `/privacy/` claimed "privacy-respecting analytics" collecting "anonymized usage statistics" that exist nowhere in the code. There was no accessibility statement, no `robots.txt`, no `sitemap.xml`, and the brand tokens were copy-pasted inline into four HTML files. Three documents still described a CAX11 ARM server that was never provisioned.

## What was built

**A static build (`build.mjs`).** `src/` holds hand-written source — EJS templates, the Tailwind entry point, brand tokens, assets — and generates `site/`, which stays committed and served from the same paths. The production server still only runs `git pull`; nothing compiles there. Brand tokens now exist once, in `src/styles/tokens.css`.

**Zero third-party requests.** The Play CDN and all Google Fonts links are gone from the four pages and from `ghost-theme/default.hbs`. Fonts are self-hosted from `@fontsource` (OFL, latin, woff2, `font-display: swap`, licences shipped alongside). `TravelingTypewriter.otf` was converted to woff2 as a one-off dev step (39,108 → 28,944 bytes, decompresses byte-identical); the `.otf` stays in `src/` as source and no longer ships.

**A truthful privacy policy.** The analytics section is gone. The page now describes what actually happens: no cookies, no analytics, no third-party requests, and an explicit statement that there is no consent banner because nothing is stored on or read from the visitor's device beyond what delivering the page requires (Sec. 25 (2) no. 2 TDDDG). Hetzner is named as processor under Art. 28, logs sit under Art. 6 (1) f), the home page's fetch to `blog.paulwerner.net` is disclosed as own infrastructure, and Ghost's own handling on the blog subdomain is described separately.

**WCAG 2.1 AA across five pages and the Ghost theme,** plus a published accessibility statement at `/accessibility/`. Skip link on every page, styled rather than hidden scrollbar, global `:focus-visible` outline, `figure`/`figcaption` for the hero attribution, `prefers-reduced-motion` honoured in JS as well as CSS. In the theme: skip link, `.sr-only` helper, an `h1` for the post index (its outline started at `h3`), post cards promoted to `h2`.

**Supporting work:** `robots.txt` and a generated `sitemap.xml`; a favicon set derived from the avatar; the contrast report turned into a build gate; the CX23 correction across `README.md`, `docs/deployment.md` and the provisioning script's comments.

## Key decisions

**Tailwind v4.3.3, not v3.4** ([decision 002](../decisions/002-static-build-tailwind-v4-and-ejs.md)). Initially planned as v3 under a "no native binaries" constraint; when that constraint was lifted the decision was re-taken on merits. The deciding argument is not currency but fit: hand-written CSS here needs the raw token values (hero gradient, `::selection`, grain overlay, `@font-face`), and v4's `@theme` emits every token as a CSS custom property automatically, where v3's JS config would force a hand-maintained `:root` block beside it — reinstating the duplication this session exists to remove. The v4 browser baseline was assessed against this site's actual compiled output rather than assumed: 45 `@property` rules (all transform sub-properties, where transforms still apply and only per-part interpolation degrades) and one `color-mix()` already wrapped in `@supports`.

**EJS, not any `{{ }}` engine.** Caddy renders `{{env "IMPRINT_STREET"}}` in the imprint at request time. Handlebars, Nunjucks and Mustache would all consume those placeholders, and the failure mode is an imprint served without an address. EJS uses `<% %>`; the build asserts both placeholders survive every render.

**Fonts audited by reference, not by the request being replaced** ([learning 004](../learnings/004-font-stacks-are-not-inventories.md)). The old Google Fonts request had drifted from reality in both directions. JetBrains Mono was requested by the landing page and rendered by nothing there — it ships with the Ghost theme only. Weight 500 was requested by both artefacts and referenced by neither. Special Elite looked used because it sat in every `font-typewriter` stack, but only behind self-hosted TravelingTypewriter, which the brand guidelines record it as the prototype stand-in for; it ships nowhere now.

**Brand tokens stay duplicated between `src/styles/tokens.css` and the Ghost theme's `:root`,** deliberately. Unifying them would make part of the hand-written theme generated output and couple every token change to a theme version bump.

## What the verification caught

The before/after screenshot comparison caught a regression nothing else could: moving the skip link into the layout put it in a directory the `@source` list did not cover, so `sr-only` was never compiled and "Skip to content" rendered as visible text on all five pages. axe reports that markup as perfectly accessible — it is, just not hidden — and Lighthouse agrees. One `@source` directive now covers all of `src/`, and the build asserts the utility exists.

The same comparison explained a 48px height change that looked like a regression and was not: the empty `#posts-list` carries both `hidden` and `flex`, and v3's preflight let `.flex` override `[hidden]`, so a hidden element still contributed its top margin. v4 marks `[hidden]` `!important`, so the dead gap under "Recent Posts" is gone.

## Final numbers

- Third-party requests across all five pages: **0** (the one non-same-origin request is the Ghost Content API call to the blog subdomain — same operator, same server, disclosed in the privacy policy)
- axe-core violations, five pages: **0**
- Lighthouse accessibility: **100** on all five; best practices **100** on all five once the blog endpoint is reachable
- Contrast: every text pair passes AA, tightest is `muted` on `inset-bg` at **4.65**; now enforced by the build
- Caddy imprint placeholders: byte-identical to `main`, asserted on every build
- A rebuild from a fresh clone reproduces the committed `site/` byte-for-byte

## Commits

| Commit | Work |
|---|---|
| `docs: add plan 013 …` | plan persisted |
| `build(site): compile Tailwind and template pages from src/` | build tooling, `src/`, single token source |
| `fix(site): self-host fonts and remove every third-party request` | zero external origins, font inventory |
| `docs(site): rewrite the privacy policy …` | truthful privacy page |
| `fix(a11y): WCAG 2.1 AA pass and accessibility statement` | a11y pass, `/accessibility/` |
| `feat(site): add robots.txt and sitemap.xml` | indexing |
| `docs: correct the server spec to Hetzner CX23 (x86_64)` | documentation correction |
| `docs: record the build decisions and refresh CLAUDE.md` | decision 002, learning 004, CLAUDE.md, README |
| `fix(build): scan all of src/ for utility classes` | skip-link regression + assertion |
| `feat(site): add a favicon set derived from the avatar` | favicon, site + theme |
| `feat(build): make the contrast report a build gate` | contrast enforced, not just reported |
| `docs(site): cite the MLBF contact form instead of a phone number` | authority contact route |

## Open items

- **MLBF details could not be verified at source.** `mlbf-barrierefrei.de` returns 403 through the build environment's proxy, as do the Bayern, Sachsen-Anhalt and Schleswig-Holstein pages. Address, email, contact-form URL and the 26 September 2025 date were corroborated across independent searches. Worth one look before the statement is treated as final.
- **Cross-architecture builds are unverified.** Repeated x86_64 builds are byte-identical and the lockfile resolves `oxide-darwin-arm64` cleanly, but no arm64 execution was possible (Docker CLI without a daemon). `site/` being committed means any divergence surfaces as a reviewable diff.
- **`.gitignore`** still ignores `landing-page/dist/`, which no longer exists, and its global `dist/` rule will swallow future app output.
- **No CSP or security headers** — requires editing the `Caddyfile`, which was out of scope. A natural next session, alongside the `/projects` case-study pages the EJS setup was chosen to support.

## Deploy notes

Nothing changes on the server: `git pull` in `/opt/paulwerner-net`, Caddy serves `./site` from the bind mount. Locally, anything touched under `src/` needs `npm run build` and the regenerated `site/` committed in the same change. The Ghost theme version was bumped three times this session (0.1.4 → 0.4.0); re-activate the theme in Admin after deploying so the `?v=` asset hash changes (learning 002).
