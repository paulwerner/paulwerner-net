# 001 — Sodo-search Tailwind preflight shrinks unsized flex children

## What was assumed

The blog's sticky-footer layout uses `body { display: flex; flex-direction: column; min-height: 100vh }` with `.site-main { flex: 1 }`. With the default `align-items: stretch`, `.site-main` was assumed to always claim the full cross-axis width up to its `max-width: 780px`. No explicit `width` was set on the flex child.

Locally this worked: `.site-main` rendered at exactly 780px on the home page. So the layout was considered correct and shipped.

## What was discovered

In production, the same CSS produced a `.site-main` with `computedMaxWidth: 780px` but a real `getBoundingClientRect().width` of **~497px** — the natural content width of the post card inside it. Local rendered correctly at 780px; production did not. Both served byte-identical theme.css.

The cause: Ghost's built-in **sodo-search** widget (loaded only when the site is reachable from the public internet, not in the local dev container in some configurations) injects its own bundled stylesheet via JavaScript at runtime. That stylesheet is built with **Tailwind v3.4.18** and ships Tailwind's full `preflight` reset, which includes:

```css
*, ::after, ::before { box-sizing: border-box; border: 0 solid #e5e7eb; }
body { margin: 0; line-height: inherit; }
html { line-height: 1.5; ... }
```

Because this CSS is injected **after** `theme.css` loads, and uses element selectors with the same specificity as our `body { ... }` rule, individual properties land on top of ours. The interaction with the body flex layout caused `.site-main` (a flex item without an explicit `width`) to shrink-to-fit instead of stretching across the cross-axis. Header and footer rendered correctly because they don't rely on flex-item cross-axis stretch (the header's inner is a normal centered block with `max-width`).

## The correct approach

Don't depend on flex-item implicit cross-axis stretch behavior for elements whose width matters. Set `width: 100%` explicitly alongside `max-width`:

```css
.site-main {
    width: 100%;
    max-width: var(--index-width);
    margin: 0 auto;
    padding: 48px 24px 96px;
}
```

This bypasses the flex-item sizing path entirely — the element claims full available width up to the cap regardless of any later-injected CSS.

## Generalizable rule

Any third-party widget that ships its own preflight or reset (Tailwind, normalize, custom) and injects it post-load can disturb cascade-dependent layout. For elements whose width or layout is structurally important, prefer **explicit declarations** over **implicit defaults** — even when the default would otherwise suffice. The cost is one extra line of CSS; the benefit is immunity to a whole class of cascade-order surprises.

This applies equally to `align-items`, `display`, `flex-direction`, and other "default-is-fine-until-it-isn't" properties on parent containers that host third-party scripts.
