# 013 — Compliance baseline: zero third-party requests, WCAG 2.1 AA, truthful privacy

## Context

paulwerner.net is being repositioned as a portfolio that sells DSGVO/BFSG compliance to German SMEs. Today the site contradicts that pitch on every page:

- All four pages load **Google Fonts** (`fonts.googleapis.com`, `fonts.gstatic.com`) and the **Tailwind Play CDN** (`cdn.tailwindcss.com`) — three third-party origins receiving every visitor's IP, with no legal basis and no consent. `ghost-theme/default.hbs` loads Google Fonts too.
- `/privacy/` **claims analytics that do not exist** in the code ("privacy-respecting analytics… anonymized usage statistics"). A privacy policy describing processing that doesn't happen is a defect in exactly the discipline being sold.
- Brand tokens (10 colors, 3 font stacks, shadow, keyframes) are **copy-pasted inline into 4 HTML files**; the Play CDN means there is no build, so every fix is a 4-way edit.
- No accessibility declaration, no `robots.txt`, no `sitemap.xml`.
- `README.md`, `docs/deployment.md` and `scripts/deploy-server.sh` describe a **Hetzner CAX11 (ARM64)** server. The live machine is a **CX23 (x86_64)**. CLAUDE.md is right; the other three are stale.

Outcome: the site itself becomes the proof of the claim — zero external requests, measured AA conformance, a privacy policy that is literally true, and a single source for brand tokens. No redesign, no new features, no new pages beyond `/accessibility/`.

## Production constraints (verified against the repo)

- `docker-compose.yml` bind-mounts `./site:/srv/site:ro`; the server only runs `git pull` in `/opt/paulwerner-net`. **`site/` stays committed and generated; nothing builds on the server.**
- `Caddyfile` runs `templates /imprint/*`. `site/imprint/index.html` contains `{{env "IMPRINT_STREET"}}` / `{{env "IMPRINT_CITY"}}` (lines 66–67), rendered at request time from `.env` via compose. **The build must emit those two lines byte-identically** → the templating engine must not use `{{ }}` delimiters, and the build asserts the exact bytes.
- Output paths must not move: `site/index.html`, `site/imprint/index.html`, `site/privacy/index.html`, `site/disclaimer/index.html` (+ new `site/accessibility/index.html`).
- No `dist/`. `docker-compose.yml`, `Caddyfile` untouched. `scripts/deploy-server.sh`: comments only (item F).

## Decisions (recorded in `docs/decisions/002-*.md`)

### Tailwind v4.3.3 — CSS-first `@theme`

The original plan chose v3.4 on the "no native binaries with arch-specific behaviour" constraint. That constraint was lifted (the build runs on one workstation; `site/` ships committed; nothing compiles on the VPS), and with it the only argument for v3 disappears. Re-decided on merits:

- **Fit, not novelty.** These pages need raw token access in hand-written CSS: the hero gradient `rgba(15,11,7,…)`, `::selection`, the grain overlay, the `@font-face` block. v4's `@theme` emits every token as a real CSS custom property automatically. v3 would require a hand-maintained parallel `:root` block beside the JS config — re-creating the exact duplication item B exists to eliminate. This is the decisive argument.
- **Currency.** v3.4 is maintenance-only. A 2026 greenfield build on a site whose selling point is technical currency should not open on an EOL-track major.
- **Browser baseline (Safari 16.4+ / Chrome-Edge 111+ / Firefox 128+), assessed against this actual output.** Compiling the real class set produces 45 `@property` rules (all transform sub-properties — transforms still apply, only per-part interpolation degrades) and exactly one `color-mix()` declaration, already wrapped in `@supports (color: color-mix(in lab, red, red))`. No layout, color, or typography on these five pages depends on an unsupported feature. Corporate German SME fleets run evergreen Edge/Chrome; the exposed cohort is Firefox 115 ESR holdouts, whose failure mode is graceful degradation of transform interpolation, not a broken page. Accessibility conformance is unaffected either way — AT and text rendering do not touch these features.
- **Reproducibility, verified.** Repeated x86_64 builds are byte-identical; the lockfile pins all 12 platform bindings and `npm ci --os=darwin --cpu=arm64` resolves `oxide-darwin-arm64` cleanly. Cross-arch *execution* could not be verified (this environment has the Docker CLI but no daemon) — recorded as a limitation. Backstop: `site/` is committed, so any divergence appears as a reviewable diff and never reaches the VPS.

**Single token source:** `src/styles/tokens.css` (the `@theme` block) — this replaces the planned `src/brand/tokens.js`. `build.mjs` parses it (`--color-*`) for the contrast report, so one file holds the hexes, nothing is generated into `src/`, and no duplication is reintroduced.

### EJS for templating

Decisive reason: EJS uses `<% %>`, so Caddy's `{{env …}}` placeholders pass through untouched. Every `{{ }}`-based engine (Handlebars, Nunjucks, Mustache) would consume them or need escaping hacks — an avoidable production-outage class. One dependency, no native code, layout + partials + per-page data, and it scales to the planned `/projects` case-study pages (add entries to the page-data array, reuse the partials) without becoming a framework. Recorded in the decision doc as the intended pattern for future static showcases — not built for them now.

### Font inventory — nothing ships unless something renders it

Every face was tested against actual references, not against the old Google Fonts request:

| Face | `site/` | `ghost-theme/` | Evidence |
|---|---|---|---|
| TravelingTypewriter 400 | ✅ woff2 | ✅ woff2 | 35 `font-typewriter` uses; `--font-display` throughout `theme.css` |
| Source Serif 4 400 / 600 / 700 / 400 italic | ✅ | ✅ | `font-serif`, `font-semibold`, `font-bold`, blockquote `italic`; theme `h1/h2` 700, `h3–h6` 600, `.post-content blockquote` italic (`theme.css:595`) |
| JetBrains Mono 400 / 400 italic / 700 | ❌ **dropped** | ✅ | `font-mono` appears **nowhere** in `site/`. Theme renders it at `theme.css:124` (`code`), `:133` (`pre`), `prism.css:14`; italic via `.token.comment`/`.token.italic`, 700 via `.token.important, .token.bold`. The **500 weight in the current Google request is referenced nowhere → dropped** |
| Special Elite 400 | ❌ **dropped** | ❌ **dropped** | Only ever the fallback slot behind TravelingTypewriter, which is self-hosted same-origin. `docs/brand/brand-guidelines.md` records it as the prototype stand-in: "Production uses the actual TravelingTypewriter file." Stack becomes `TravelingTypewriter → system monospace` |

`fontFamily.mono` stays in the token file as a brand record; with v4's JIT no `.font-mono` rule is emitted while no page uses it (verified in the compiled output).

### Ghost theme token duplication — flagged, not fixed

`ghost-theme/assets/css/theme.css` keeps its hand-written `:root` block. The 10-hex duplication across the two artifacts is flagged in the PR (decided: site-only single source).

### Verification gate 1 scope

Gate 1 runs over served HTML/CSS/`.hbs`. The two `jsdelivr` hits in `ghost-theme/assets/js/prism.js` are source-attribution comments in the vendored banner, not requests. The PR shows both the narrowed grep (zero matches) and the raw grep with the two comment lines called out.

## Work

### 0. `docs: add plan 013` — this file

### B. `build(site): compile Tailwind and template pages from src/`
Root `package.json` (`private`, `type: module`) + `package-lock.json`. devDeps: `tailwindcss@4`, `@tailwindcss/cli@4`, `ejs`, `@fontsource/*` (added in A). Scripts: `build`, `dev` (watch), `verify:no-third-party`.

```
src/
  data/pages.js          # slug, title, description, updated, navLabel per page
  pages/*.ejs            # index, imprint, privacy, disclaimer (accessibility added in D)
  partials/head.ejs, footer.ejs, skip-link.ejs
  styles/tokens.css      # @theme — the ONE token definition
  styles/main.css        # imports tokens.css, @font-face block, the few real custom rules
  assets/                # images + TravelingTypewriter.otf (source of truth)
build.mjs                # render → write → compile CSS → copy assets → assert
```

`build.mjs` renders each page to `site/<slug>/index.html` (root → `site/index.html`), writes `<!DOCTYPE html>` plus a generated-file banner (`do not edit — source: src/pages/x.ejs, run npm run build`), runs the Tailwind CLI to `site/assets/css/main.css` (minified, deterministic), copies fonts/images, and **asserts** the imprint output contains `{{env "IMPRINT_STREET"}}` and `{{env "IMPRINT_CITY"}}` verbatim — build fails otherwise. HTML is not minified so rendered-output diffs stay reviewable.

Behaviour-neutral commit: same markup, same classes, Google Fonts links still present (removed in A). One deliberate diff — the legal pages' three footer social links are `href="#"` today (dead links); the shared footer partial gives them the real GitHub/blog/LinkedIn targets already used on the landing page.

### A. `fix(site): remove all third-party requests`
- Drop the Play CDN `<script>` + inline `tailwind.config` and the three `fonts.googleapis`/`gstatic` tags from the 4 pages **and** `ghost-theme/default.hbs`.
- Self-host per the inventory table above via `@fontsource/source-serif-4` and `@fontsource/jetbrains-mono` (both OFL): latin subset, woff2 only, `font-display: swap`. Licenses copied to `site/assets/fonts/licenses/` and `ghost-theme/assets/fonts/licenses/`.
- `preload` only above-the-fold faces: TravelingTypewriter + Source Serif 4 400.
- Convert `TravelingTypewriter.otf` → woff2 as a one-off dev step (no repo dependency; command documented). Ship woff2 only; keep the `.otf` as source in `src/assets/fonts/`.
- Ghost theme: same `@font-face` block in `theme.css`, fonts under `ghost-theme/assets/fonts/`, and **bump `ghost-theme/package.json` version** (learning 002 — the `?v=` hash is per-theme-version).
- Keep the Ghost Content API keys; keep/tighten the one-line comment explaining they are read-only and public by design (`site/index.html:229`).

### C. `docs(site): rewrite privacy policy to match actual processing`
Replace the false "Web Analytics" section. New content: no cookies, no analytics, no third-party requests, no consent banner (stated explicitly — there is nothing to consent to); Hetzner Online GmbH as processor under an AVV, server logs and IP handling under Art. 6(1)(f); the client-side `fetch` to `blog.paulwerner.net` (own infrastructure, same operator, no third party); Ghost's own processing on the blog subdomain; self-hosted fonts stated explicitly; contact-by-email and data-subject rights kept; `Last updated` refreshed.

### D. `fix(a11y): WCAG 2.1 AA pass on site and Ghost theme`
Audit findings so far (full audit during implementation):
- Skip link exists only on `index.html` → all pages via shared partial.
- `html { scrollbar-width: none }` hides the scrollbar on every page → restore a styled, visible scrollbar.
- `scrollIntoView({behavior:'smooth'})` ignores `prefers-reduced-motion` (the CSS path handles it, the JS path doesn't).
- `<cite>` sits outside its `<blockquote>` → wrap in `<figure>/<figcaption>`.
- Dead `href="#"` social links on the three legal pages (fixed in B).
- Landmarks, heading order, `alt` handling verified per page.
- Ghost theme already ships `:focus-visible` (`theme.css:86`) and a reduced-motion block (`:890`) — add the missing skip link to `default.hbs`, verify heading order in `post/tag/page/error-404`, `alt` handling in `post-card` and feature images, nav/pagination labels. Theme version bumped again.
- **Contrast, measured from the actual tokens** (sRGB, WCAG formula) — all text pairs already pass AA:

| fg | on `bg` #0f0b07 | on `card-bg` #161210 | on `inset-bg` #1e1a16 |
|---|---|---|---|
| `text` #d8d6cf | 13.48 | 12.80 | 11.89 |
| `link` #f4e4c0 | 15.59 | 14.81 | 13.75 |
| `gold` #f3ca84 | 12.69 | 12.05 | 11.19 |
| `accent` #be884b | 6.36 | 6.04 | 5.61 |
| `hover` #ae8d67 | 6.35 | 6.03 | 5.60 |
| `muted` #8a8478 | 5.28 | 5.01 | 4.65 |
| `border` #2a2420 | 1.28 | 1.22 | 1.13 |

`bg` on the `accent` button = 6.36. Focus outline `accent` vs `bg` = 6.36 (needs 3.0) ✓. `border` at 1.28 is decorative only (dividers, inactive card outlines that also carry a background shift) — no palette change; stated in the PR with numbers.

- New `site/accessibility/index.html` — Barrierefreiheitserklärung in English, matching the legal-page layout:
  - **Framing: voluntary conformance.** The site is operated by a sole proprietor and falls under the BFSG micro-enterprise exemption (fewer than 10 employees, ≤ €2M annual turnover/balance sheet). The declaration states plainly that BFSG imposes no obligation here and that WCAG 2.1 AA is met **by choice**. Claiming a duty that does not exist is the same defect class as the analytics claim in item C.
  - **Enforcement body: MLBF.** Marktüberwachungsstelle der Länder für die Barrierefreiheit von Produkten und Dienstleistungen (MLBF AöR), Carl-Miller-Straße 6, 39112 Magdeburg, `kontakt@mlbf-barrierefrei.de`, mlbf-barrierefrei.de — operative since 26 September 2025. Not the Schlichtungsstelle nach § 16 BGG, not a Landesbeauftragte, not the Überwachungsstelle des Bundes (all public-sector/BITV 2.0).
  - **Verification limitation:** `mlbf-barrierefrei.de` and the Bayern / Sachsen-Anhalt / Schleswig-Holstein pages are unreachable from the build environment (proxy 403). Details corroborated across two independent searches; sources **disagree on the phone number**, so the page cites postal address, email and website only. Flagged in the PR for confirmation before publishing.
  - Plus: scope (paulwerner.net; blog subdomain noted separately), conformance status and self-assessment method with date, known limitations, feedback route (`contact@paulwerner.net`) with response expectation.
  - Added to the footer nav on all pages and to the Ghost theme footer.

### E. `feat(site): add robots.txt and sitemap.xml`
`site/robots.txt`: explicit `User-agent: *` group allowing everything, `Sitemap:` line, and a commented, delimited section documenting that future demo subdomains are disallowed by giving each host its **own** robots.txt (robots.txt is per-host — the root file cannot govern them), so this file never needs a rewrite. `site/sitemap.xml` generated by `build.mjs` from `src/data/pages.js` with explicit per-page `lastmod` (deterministic, no build-time clock). Blog keeps Ghost's own sitemap.

### F. `docs: correct server spec to Hetzner CX23 (x86_64)`
- `README.md:7` — CAX11/ARM64 → CX23, 2 vCPU / 4 GB / 40 GB NVMe, x86_64 (Intel Xeon), Nuremberg, 20 TB traffic.
- `docs/deployment.md` — Plan → `CX23 (x86_64, 2 vCPU, 4 GB RAM, 40 GB NVMe)`, OS → `Ubuntu 24.04 LTS (x86_64)`; update-workflow matrix gains a `site/` note ("regenerate with `npm run build` before committing").
- `scripts/deploy-server.sh` lines 2–3 — header comments only. Provisioning logic untouched (it already derives arch via `dpkg --print-architecture`).
- `docs/plans/`, `docs/sessions/` left alone (immutable).

### G. `docs: record decisions and update CLAUDE.md`
`docs/decisions/002-static-build-tailwind-v4-and-ejs.md`. CLAUDE.md: tech stack (compiled Tailwind v4, no CDN), directory structure (`src/`, `build.mjs`, generated `site/`), build/deploy note. `docs/learnings/004-*.md` if implementation turns up a genuine surprise. Session summary only after acceptance.

## Verification (real output pasted into the PR)

Local static serve for page-level gates (`python3 -m http.server` over `site/`).

1. Narrowed grep over served HTML/CSS/`.hbs` → zero matches; raw grep also shown with the two prism.js comment lines called out.
2. Playwright request log per page → zero non-`localhost` origins, all 5 pages.
3. axe-core on all 5 pages → zero violations.
4. Lighthouse (bundled Chromium) on all 5 pages → all four scores reported, a11y = 100.
5. Contrast table regenerated from `src/styles/tokens.css` so the numbers provably match shipped tokens.
6. Full-page screenshots before (`main`) vs after, desktop + mobile → visually identical except deliberate a11y changes, each annotated.
7. `git diff` of `site/imprint/index.html` showing lines 66–67 byte-identical; build asserts it too. **Limitation:** no Docker daemon in this environment, so the live Caddy `templates` render could not be exercised — the assertion is on the bytes Caddy consumes.
8. `grep -riE "cax11|arm64|aarch64" README.md docs/ scripts/ CLAUDE.md` → hits only under `docs/plans/` and `docs/sessions/`.
9. Fresh-clone simulation: `site/` renders with no `node_modules` present.

## Flagged, not fixed

- `.gitignore` still ignores `landing-page/dist/` (gone) and has a global `dist/` rule that will swallow future app output.
- Brand-token hexes exist in both `src/styles/tokens.css` and `ghost-theme/assets/css/theme.css`.
- `docs/deployment.md` hardcodes the production IPv4.
- No CSP / security headers — requires editing `Caddyfile`, out of scope. Follow-up session.
- MLBF phone number omitted pending confirmation (sources disagree; authority site unreachable from here).

## Branch and commits

Branch: `claude/portfolio-compliance-baseline-xfrok4` (provisioned). PR opened from it. One commit per work item, conventional format, each independently revertible.
