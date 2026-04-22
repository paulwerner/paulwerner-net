# Session 002 — Landing Page Implementation

## Context

The current `site/index.html` is a 14-line placeholder ("Placeholder landing page. The real design lands in Phase 2/3."). With Phase 2 brand work landed (`docs/brand/brand-guidelines.md` approved April 2026, `docs/brand/legacy_reference.png` for visual context) and the static assets already staged in `site/assets/` (`background.png`, `avatar_small.png`, `fonts/TravelingTypewriter.otf`), this session replaces the placeholder with the complete five-section landing page — plain HTML + Tailwind CSS via the Play CDN, no framework, no build step. The output should render correctly when served as static files by Caddy (Phase 3).

Out of scope: Ghost integration, the Ghost theme, VPS deployment, final copy, and any change to `docker-compose.yml` / `Caddyfile`.

## Key observations from exploration

- **Brand guidelines are prescriptive.** Every color token, type-scale row, padding value, transition timing, border thickness, and animation spec is fixed. The page is mostly direct translation; the design space is small.
- **Legacy reference confirms the layout.** Sepia harbor backdrop with industrial silhouettes; centered amber-bordered card containing avatar overlapping top, "Paul Werner" name, `{ SOFTWARE ENGINEER }` role title, italic quote with attribution; "scroll" indicator below the card; thin three-column footer (legal links left, three social icons center, copyright right).
- **Tailwind decision diverges from CLAUDE.md.** CLAUDE.md tech-stack section claims Tailwind is "compiled at build time via the Tailwind CLI" with "no JS runtime required." The Session 002 prompt explicitly chooses the Play CDN script and lists "Tailwind CDN" as an allowed external dependency. The deliverables list scopes the CLAUDE.md edit to *Directory Structure* only — i.e. the prompt deliberately does not ask us to reconcile the tech-stack note. **This session honors the prompt (CDN) and leaves the CLAUDE.md tech-stack claim untouched.** A later session is the right place to either (a) ratify CDN in CLAUDE.md, or (b) introduce a real CLI build step. Worth surfacing at session-summary time.
- **Open items already accepted.** Brand guidelines flag the floating avatar as "visually squeezed" with the single asset, and accept that for prototyping. We use the same `avatar_small.png` for both card (140px) and floating (44px) instances.
- **Grain texture is the only "asset that might need to be created."** Inlining as an SVG `feTurbulence` data URI keeps the deliverable to a single HTML file and avoids an extra HTTP request — preferred over committing a separate `.svg`.
- **Session 001 conventions.** One commit per logical step (no batching), commit messages prefixed by Conventional-Commit type (`feat`, `docs`, `chore`), section-by-section commits are an established pattern.

## Approach

### Tailwind setup

CDN script in `<head>`, with inline `tailwind.config` script *before* the CDN load so the customisations apply on first paint:

```js
tailwind.config = {
  theme: {
    extend: {
      colors: {
        bg: '#0f0b07', 'card-bg': '#161210', 'inset-bg': '#1e1a16',
        accent: '#be884b', text: '#d8d6cf',
        link: '#f4e4c0', gold: '#f3ca84', hover: '#ae8d67',
        muted: '#8a8478', border: '#2a2420',
      },
      fontFamily: {
        typewriter: ['TravelingTypewriter', '"Special Elite"', 'monospace'],
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: { card: '9px 8px 11px -4px rgba(0,0,0,0.3)' },
      keyframes: {
        'hero-in': { '0%': { opacity: '0', transform: 'translateY(12px)' },
                     '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: { 'hero-in': 'hero-in 0.6s ease-out both' },
    }
  }
}
```

Use `font-typewriter` / `font-serif` / `font-mono` and the brand color tokens (`bg-bg`, `text-text`, `border-accent`, `text-muted`, etc.) throughout.

### Fonts

- **Google Fonts `<link>`**: Source Serif 4 (400, 600, 700, 400i), JetBrains Mono (400, 500), Special Elite (400 — fallback for TravelingTypewriter).
- **`@font-face`**: TravelingTypewriter from `assets/fonts/TravelingTypewriter.otf`, `font-display: swap`.

### Global `<style>` block (small, scoped to what Tailwind utilities can't express)

- `html { scroll-behavior: smooth; }` with `@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }`
- `::selection { background: #be884b; color: #0f0b07; }`
- Hero background layers: `background.png` `top center` `contain` `attachment: fixed`, with `@media (max-width: 640px) { attachment: scroll; }` for iOS.
- Hero gradient overlay: `linear-gradient(to bottom, rgba(15,11,7,0) 0%, rgba(15,11,7,0.15) 50%, rgba(15,11,7,1) 100%)`.
- Grain texture: inline SVG `feTurbulence` data URI, `opacity: 0.03`, `mix-blend-mode: overlay`.

### Section markup

All within a single `<body>` — semantic landmarks, no nested wrappers beyond what's needed.

1. **`<a href="#main" class="sr-only focus:not-sr-only ...">Skip to content</a>`** — accessibility skip link.
2. **Floating avatar** (`<div id="floating-avatar">` outside `<main>`) — fixed top-left 20px/20px, 44px circle, 2px accent border, initial state `opacity-0 scale-75 pointer-events-none`, `transition-all duration-300 motion-reduce:transition-none`. Toggled by JS.
3. **`<main id="main">`** wraps the five sections.
4. **`<section id="hero">`** — `min-h-screen grid place-items-center relative overflow-hidden`. Three stacked absolute layers (background image / gradient / grain SVG) behind the centered card. Card (`<div id="hero-card">`): `max-w-[640px] w-[85%] mx-auto bg-bg border-[3px] border-accent rounded-md shadow-card px-8 pt-5 pb-9 text-center motion-safe:animate-hero-in`. Children:
   - Avatar `<img>` — 140px circle, 3px accent border, `mt-[-70px]` to overlap card top, alt "Cartoon avatar of Paul Werner."
   - `<h1>` — `font-serif text-[36px] font-bold tracking-[1px]` "Paul Werner".
   - `<p>` role — `font-typewriter text-base uppercase tracking-[4px]` "{ SOFTWARE ENGINEER }".
   - `<blockquote>` — italic Source Serif 4 15px, `max-w-[480px] mx-auto`, plausible placeholder line.
   - `<cite>` attribution — `font-typewriter text-[13px] tracking-[1px] text-hover not-italic`.
   - Scroll indicator `<a id="scroll-indicator" href="#about">` — absolutely positioned bottom-center of `#hero`, `font-typewriter text-[11px] uppercase tracking-wider text-muted`, with chevron-down SVG below the label.
5. **`<section id="about">`** — `max-w-[720px] mx-auto pt-[100px] pb-[80px] px-6`. Heading component (h2 "ABOUT" `font-typewriter text-[28px] tracking-[2px] text-center` + 40×2 amber underline bar `<span class="block w-10 h-0.5 bg-accent mx-auto mt-2"></span>`). Inner `max-w-[600px] mx-auto mt-12`, `font-serif text-[17px] leading-[1.8] text-text`. Two short paragraphs of plausible Berlin-based-freelancer copy (no lorem ipsum).
6. **`<section id="posts">`** — `max-w-[780px] mx-auto pt-10 pb-[80px] px-6`. Same heading component, "RECENT POSTS". Three `<article>` post cards in a `flex flex-col gap-4`. Each card: `bg-card-bg border border-border rounded-md p-7 transition-all duration-300 hover:bg-inset-bg hover:border-accent`. Inside: title `<h3>` (`font-serif text-[20px] font-semibold leading-[1.35] text-text group-hover:text-link`), excerpt `<p>` (`font-serif text-[15px] text-muted leading-[1.6] mt-2`), bottom row `<div class="flex items-center gap-4 mt-4">` with date (`font-typewriter text-[11px] uppercase tracking-[1.5px] text-muted`) and 2-3 tag pills. Below the stack: centered "ALL POSTS →" link (`font-typewriter text-[14px] uppercase tracking-[1.5px] text-link`) with diagonal-arrow SVG.
7. **`<section id="projects">`** — `max-w-[720px] mx-auto pt-10 pb-[100px] px-6`. Heading "PROJECTS". Three `<article>` items in `flex flex-col gap-2`. Each: `border-l-2 border-border hover:border-accent transition-all duration-300 px-6 py-5`. Top row `<div class="flex items-baseline justify-between gap-4">` with project name (`font-typewriter text-[18px] text-text`) and tech stack (`font-mono text-[11px] tracking-[0.5px] text-muted`). Description `<p>` (`font-serif text-[15px] text-muted mt-2`).
8. **`<footer>`** — `max-w-[960px] mx-auto border-t border-border mt-0 px-6 py-8`. `flex items-center justify-between gap-6` (stacks vertically below `sm`). Three groups: legal links (Imprint / Privacy / Disclosure — `font-typewriter text-[13px] tracking-[0.5px] text-muted hover:text-link`), centered social SVG icons (GitHub, Book/Blog, LinkedIn — 22px stroke 1.5, `text-muted hover:text-link`, each wrapped in `<a aria-label="...">`), copyright "© 2026 PW" (`font-typewriter text-[13px] text-muted`).

### Tag pill component

Inline reusable utility class combo: `inline-block font-typewriter text-[12px] tracking-[0.5px] text-accent border border-border rounded-[3px] px-2.5 py-0.5`.

### JavaScript (single `<script>` at end of body)

```js
const card = document.getElementById('hero-card');
const float = document.getElementById('floating-avatar');
new IntersectionObserver(([e]) => {
  const hide = e.isIntersecting;
  float.classList.toggle('opacity-0', hide);
  float.classList.toggle('scale-75', hide);
  float.classList.toggle('pointer-events-none', hide);
}, { threshold: 0.1 }).observe(card);

document.getElementById('scroll-indicator').addEventListener('click', (ev) => {
  ev.preventDefault();
  document.getElementById('about').scrollIntoView({ behavior: 'smooth' });
});
```

The scroll indicator is also a real `<a href="#about">` so it works without JS.

### Responsive

- **Mobile (≤ 640px)**: hero card `w-[90%]` with reduced inline padding; avatar 110px (with `mt-[-55px]`); name h1 `text-[28px]`; section vertical paddings ~70/60px; footer flex switches to column with centered groups; `background-attachment: scroll`.
- **Tablet (641–1024px)**: layout matches desktop; horizontal padding eased to `px-8`.
- **Desktop (≥ 1024px)**: brand-guidelines values exactly.

Implementation uses Tailwind's `sm:` / `md:` / `lg:` modifiers; baseline classes target mobile.

### Accessibility

- Semantic landmarks (`<header>` for floating avatar wrapper, `<main>`, `<section id>` per scroll target, `<article>`, `<footer>`).
- Skip link to `#main`.
- All `<img>` with descriptive alt; decorative SVG icons get `aria-hidden="true"` inside `<a aria-label="...">`.
- `focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2` on every interactive element.
- `motion-safe:` prefix on hero card animation; `motion-reduce:transition-none` on floating avatar; smooth scroll disabled by media query.
- Color contrast: brand body text `#d8d6cf` on `#0f0b07` — comfortably above WCAG AA for body text.

## Implementation steps (one commit per step, per CLAUDE.md workflow)

1. **Persist plan** — copy this file to `docs/plans/002-landing-page.md` (next sequential index after 001). Commit: `docs: add session 002 plan`.
2. **Foundation** — replace `site/index.html` with: `<head>` (Tailwind CDN, inline tailwind.config, Google Fonts links, `@font-face` for TravelingTypewriter, global `<style>` for selection / scroll-behavior / hero background layers / grain SVG / mobile attachment fallback / motion-reduce overrides), `<body>` with skip link, empty floating-avatar div, `<main>` containing five empty `<section>` landmarks, empty `<footer>`. Commit: `feat(site): scaffold landing page foundation`.
3. **Hero section** — populate `#hero` (background layers, card with avatar/name/role/quote/attribution, scroll indicator). Mobile responsive. Commit: `feat(site): build hero section`.
4. **About section** — heading bar + two paragraphs of plausible placeholder copy. Commit: `feat(site): build about section`.
5. **Recent Posts section** — heading + three placeholder post cards (title, excerpt, date, 2-3 tag pills) + centered "All Posts →" link. Hover transitions. Commit: `feat(site): build recent posts section`.
6. **Projects section** — heading + three placeholder project items with left-border accent and tech stack labels. Commit: `feat(site): build projects section`.
7. **Footer** — three-column layout with legal links, social SVG icons, copyright. Mobile stacking. Commit: `feat(site): build footer`.
8. **JavaScript behaviors** — IntersectionObserver toggles floating avatar; click handler smooth-scrolls to About. Commit: `feat(site): wire floating avatar and scroll indicator`.
9. **CLAUDE.md directory structure** — extend the tree to show `site/assets/` with `background.png`, `avatar_small.png`, and `fonts/TravelingTypewriter.otf`. No other CLAUDE.md edits this session. Commit: `docs: update directory structure for site assets`.
10. **Review checkpoint** — pause for user review per CLAUDE.md session lifecycle. No commit.
11. **Session summary** (only after acceptance) — write `docs/sessions/002-landing-page.md` covering what was built, key decisions (Tailwind via CDN per session prompt; tech-stack reconciliation deferred; grain texture inlined as data URI; single avatar asset reused for floating instance per accepted open item), commits made, and what's next (likely: Phase 3 deployment or final copy pass). Commit: `docs: add session 002 summary`.

## Critical files

- `site/index.html` — full rewrite (currently a 14-line placeholder).
- `CLAUDE.md` — Step 9 only: extend the Directory Structure tree to include `site/assets/` and `site/assets/fonts/TravelingTypewriter.otf`. **Do not modify** the Tech Stack section's "compiled at build time via the Tailwind CLI" claim this session.
- `docs/plans/002-landing-page.md` — created in step 1 (copy of this plan).
- `docs/sessions/002-landing-page.md` — created in step 11 after user acceptance.
- `docs/brand/brand-guidelines.md` — read-only source of truth for design.
- `site/assets/{background.png, avatar_small.png, fonts/TravelingTypewriter.otf}` — read-only existing assets.

## Verification

1. **Local serve**: `python -m http.server -d site 8000` (or any static server). Open http://localhost:8000. Avoid `file://` — local fonts and the Tailwind CDN config script behave more reliably under HTTP.
2. **Five sections render**: hero (centered card on harbor backdrop), about (centered prose), recent posts (three cards stacked), projects (three left-border items), footer (three columns). All match brand-guidelines spacing and typography.
3. **Responsive sweep**: dev-tools device emulation at 375px (mobile), 768px (tablet), 1280px (desktop). Confirm hero card scales, footer stacks below `sm`, no horizontal overflow at any width, type sizes scale gracefully.
4. **Interactions**: hover post cards (border + bg lift), hover project items (left border highlight to accent), click scroll indicator (smooth scroll to About), scroll past hero (floating avatar fades in top-left), scroll back into hero (floating avatar fades out).
5. **Accessibility**: tab through page (skip link surfaces, focus-visible outline visible on every interactive element). Toggle dev-tools "Emulate prefers-reduced-motion: reduce" — confirm hero card animation skipped and smooth scroll disabled.
6. **Color/font fidelity**: amber accent (`#be884b`) on hero card border, section underline bars, project hover border, tag borders. Body text warm cream (`#d8d6cf`) on dark sepia (`#0f0b07`). TravelingTypewriter rendered (or Special Elite if local font fails to load).
7. **No console errors**.
8. **External requests audit**: dev-tools network tab shows requests only to `cdn.tailwindcss.com`, `fonts.googleapis.com`, `fonts.gstatic.com`, plus same-origin assets. No other third-party hosts.
