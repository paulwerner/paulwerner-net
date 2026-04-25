# Session 009 — Post Card Width Alignment

## Context

The post cards on the blog index (`blog.paulwerner.net`) render visibly narrower than the cards on the landing page (`paulwerner.net`). The user wants both to look identical — same width, padding, typography, hover behavior. This is the final polish pass before the site is considered done.

**Surprising finding from investigation:** the source CSS on both sides already targets the same dimensions:

- Landing: `<section id="posts-section" class="max-w-[780px] mx-auto ... px-6">` → expected 780px outer, ~732px inner card width.
- Ghost: `.home-template .site-main, .tag-template .site-main, .paged .site-main { max-width: var(--index-width); }` where `--index-width: 780px`, with `padding: 48px 24px 96px` → expected 732px inner card width.

Card-level styles (padding 28px / 24px below 640px, border-radius 6px, gap 16px, border 1px) and inner-element styles (title 20px/600/serif, excerpt 15px/muted/serif, date 11px/typewriter/uppercase, tag-pill 12px/typewriter/accent) **also already match** the brand spec on both sides.

Yet `curl` confirms the live HTML on both properties has the expected classes, and the screenshots clearly show a width mismatch. This means the bug is at the **runtime CSS layer**, not in the source values. The most likely culprit: **the Tailwind Play CDN is not generating a rule for the arbitrary-value class `max-w-[780px]`** on the deployed landing page, so `#posts-section` falls back to full-width and its child card stretches with it. The blog renders correctly at the brand-spec 780px; the landing page is the one that's actually broken.

## Approach

Per user direction ("Match the landing page as-is"), the goal is visual parity. The cleanest interpretation that also honors the brand spec (780px in `docs/brand/brand-guidelines.md:82`) is: **fix the landing page so it actually renders at 780px** (which is what its source already says it should), then verify the blog already matches at 780px. No need to widen the brand spec or the blog if the landing-page render bug is the real culprit.

Two defensive changes total — one per property — both small.

## Changes

### 1. Landing page — guarantee the 780px cap regardless of Tailwind CDN behavior

**File:** `site/index.html`

In the inline `<style>` block (lines 52–87), add an explicit rule that doesn't depend on the Tailwind CDN parsing the arbitrary-value class:

```css
#posts-section { max-width: 780px; }
```

Keep the `max-w-[780px]` Tailwind class on the `<section>` for source-readability and so the styling intent stays co-located with the markup, but the inline rule provides a guaranteed fallback. This is belt-and-suspenders against:
- Tailwind CDN failing to process bracket-arbitrary classes
- CDN script being blocked / slow / cached stale
- Any future migration off the CDN losing the rule

No other Tailwind classes need this treatment — `max-w-[640px]`, `max-w-[480px]`, `max-w-[720px]`, `max-w-[600px]`, `max-w-[960px]` are also arbitrary values, but only `#posts-section` is in scope for this session. If those turn out to be misrendering too, that's a separate session.

### 2. Ghost theme — make the 780px rule body-class-independent

**File:** `ghost-theme/assets/css/theme.css` (lines 165–175)

The current rule scopes 780px to specific body classes:

```css
.site-main { max-width: var(--content-width); ... }  /* 720px default */
.home-template .site-main,
.tag-template .site-main,
.paged .site-main { max-width: var(--index-width); }  /* 780px */
```

This works *if* Ghost emits the expected body class. To remove the dependency and reduce surface area for future drift (custom routes, author pages, RSS-derived templates, etc., that don't carry one of those three body classes), invert the rule:

```css
.site-main {
    max-width: var(--index-width);  /* 780px default — listing-style */
    margin: 0 auto;
    padding: 48px 24px 96px;
}

.post-template .site-main,
.page-template .site-main {
    max-width: var(--content-width);  /* 720px — narrower reading column */
}
```

**Why:** listings and the home page are the common case; single-post is the exception. Defaulting to 780px makes the layout "wide unless explicitly narrowed for reading," which is more robust than enumerating every listing-context body class.

### 3. No card-style changes needed

Card padding (28px / 24px<640), border (1px), border-radius (6px), gap (16px), hover (bg→inset-bg, border→accent), title (20px/600 serif), excerpt (15px muted serif mt-8px), meta (mt-16px, gap-16px), date (11px/1.5px typewriter uppercase muted), tag-pill (12px/0.5px typewriter accent, 1px border, 3px radius, 2px 10px padding) — all already match the brand spec on both sides per inspection of `theme.css` and `site/index.html`. No edits required.

## Files modified

- `site/index.html` — add one CSS rule inside the existing `<style>` block
- `ghost-theme/assets/css/theme.css` — restructure the `.site-main` max-width rules (lines 165–175)

## Files NOT modified (verified already correct)

- `ghost-theme/partials/post-card.hbs` — markup matches landing card structure
- `ghost-theme/index.hbs` — `.posts` flex container with 16px gap is correct
- `docs/brand/brand-guidelines.md` — 780px target is preserved; no spec change

## Commit plan

Single commit (per CLAUDE.md "commit after each successfully completed step"):

1. `fix(layout): guarantee 780px cap on landing posts section and broaden Ghost listing width`

Both changes serve the same goal (cards align at 780px on both properties) and verifying one without the other doesn't make sense, so they belong in one commit. After acceptance:

2. `docs: add session 009 summary`

## Verification

1. **Same-viewport side-by-side**: open `https://paulwerner.net` and `https://blog.paulwerner.net` in two browser windows of identical width (e.g. both at 1440px). The "Recent Posts" / blog index card edges should land at the same x-coordinates. DevTools → inspect the card → Computed → `max-width` should report 780px on the parent container of both.
2. **Responsive sweep**: 375px (cards full-width minus 24px padding), 768px (cards full-width minus 24px padding), 1280px (cards capped at 780px outer / 732px inner). Both properties should behave identically at each breakpoint.
3. **Single post regression check**: visit any single post on the blog (`blog.paulwerner.net/<slug>/`). The `.site-main` should narrow to 720px (the reading column). Check via DevTools Computed `max-width`.
4. **Tag/paged regression check**: visit a tag page and a paginated index page. Cards should remain at 780px container.
5. **Hover parity**: hover a card on each property. Background should shift to `inset-bg`, border to `accent`, title color to `link`, with the same 0.3s transition feel.

If after step 1 the cards still don't align, the diagnosis was wrong (Tailwind CDN was applying `max-w-[780px]` after all) and the real cause is something else — likely a viewport-width mismatch in the original screenshots, or a deploy/cache lag. In that case, re-measure with both windows confirmed at the same width before doing any further code changes.
