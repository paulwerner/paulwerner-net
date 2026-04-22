# Brand Guidelines — paulwerner.net

**Status:** Approved — April 2026
**Phase:** Brand & Design

---

## Color Palette

All colors are derived from the legacy site CSS with extensions for blog-ready UI elements.

### Core Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `bg` | `#0f0b07` | Page background, card backgrounds |
| `card-bg` | `#161210` | Slightly lifted surface (post cards, inset areas) |
| `inset-bg` | `#1e1a16` | Hover states on cards, code block backgrounds |
| `accent` | `#be884b` | Primary accent — card borders, highlights, active elements, selection background |
| `text` | `#d8d6cf` | Primary body text |
| `link` | `#f4e4c0` | Link default state, cream/warm white |
| `gold` | `#f3ca84` | Link visited state, secondary accent |
| `hover` | `#ae8d67` | Link hover state, attribution text |
| `muted` | `#8a8478` | Secondary text — dates, metadata, excerpts, attribution |
| `border` | `#2a2420` | Subtle borders, dividers, inactive card borders |

### Usage Rules

- Dark theme only. No light mode variant planned.
- `accent` (`#be884b`) is the dominant brand color — used sparingly for maximum impact: borders, active states, tag accents, selection highlight.
- Body text is `text` (`#d8d6cf`), never pure white.
- Links follow the legacy state cycle: `link` → `hover` → `gold` (visited) → `accent` (active).
- Card hover: border transitions from `border` to `accent`, background lifts from `card-bg` to `inset-bg`.

---

## Typography

### Font Stack

| Role | Font | Fallback | Weight | Usage |
|------|------|----------|--------|-------|
| **Display / UI** | TravelingTypewriter | `'Special Elite', monospace` | Normal | Role title `{ SOFTWARE ENGINEER }`, section headings, dates, tags, footer links, navigation |
| **Body / Reading** | Source Serif 4 | `Georgia, serif` | 400, 600, 700 | Name heading, about text, post excerpts, blog body text, quote text |
| **Code** | JetBrains Mono | `monospace` | 400, 500 | Inline code, code blocks, tech stack labels |

### Notes

- **TravelingTypewriter** is a custom `.otf` font from the legacy site. In prototypes, **Special Elite** (Google Fonts) serves as a close stand-in. Production uses the actual TravelingTypewriter file.
- **Source Serif 4** was chosen to pair with TravelingTypewriter. It provides warmth and high readability for long-form content while complementing the typewriter aesthetic. The legacy site used TravelingTypewriter for all text — this pairing evolves the brand for blog readability without losing character.
- **JetBrains Mono** is the code font for the Ghost theme (syntax highlighting, inline code, code blocks). On the landing page it appears only in project tech stack labels.

### Type Scale

| Element | Font | Size | Weight | Letter Spacing | Notes |
|---------|------|------|--------|----------------|-------|
| Name (h1) | Source Serif 4 | 36px | 700 | 1px | |
| Role title | TravelingTypewriter | 16px | Normal | 4px | Uppercase, wrapped in `{ }` |
| Section heading (h2) | TravelingTypewriter | 28px | Normal | 2px | Centered, with 40px amber underline bar |
| Quote text | Source Serif 4 | 15px | 400 italic | — | Max-width 480px |
| Quote attribution | TravelingTypewriter | 13px | Normal | 1px | Color: `hover` |
| Body text | Source Serif 4 | 17px | 400 | — | Line-height 1.8 |
| Post card title | Source Serif 4 | 20px | 600 | — | Line-height 1.35 |
| Post card excerpt | Source Serif 4 | 15px | 400 | — | Color: `muted`, line-height 1.6 |
| Post card date | TravelingTypewriter | 11px | Normal | 1.5px | Uppercase, color: `muted` |
| Tag | TravelingTypewriter | 12px | Normal | 0.5px | Color: `accent`, bordered |
| Project name | TravelingTypewriter | 18px | Normal | — | |
| Project tech | JetBrains Mono | 11px | 400 | 0.5px | Color: `muted` |
| Project description | Source Serif 4 | 15px | 400 | — | Color: `muted` |
| Footer links | TravelingTypewriter | 13px | Normal | 0.5px | Color: `muted` |

---

## Layout & Spacing

### Landing Page Structure

The landing page is a single vertical scroll with five sections:

1. **Hero** — Full viewport height. Harbor background image with gradient fade. Centered card with avatar, name, role, quote. Scroll indicator at bottom.
2. **About** — Centered text block. Max-width 600px within 720px container. Padding: 100px top, 80px bottom.
3. **Recent Posts** — Stacked post cards. Max-width 780px. Padding: 40px top, 80px bottom.
4. **Projects** — Left-border accent list. Max-width 720px. Padding: 40px top, 100px bottom.
5. **Footer** — Three-column: legal links (left), social icons (center), copyright (right). Max-width 960px. Top border: 1px `border` color.

### Hero Background

- Image: `background.png` (harbor silhouette)
- Sizing: `background-size: contain`, `background-position: top center`
- Parallax: `background-attachment: fixed` (CSS-only, no JavaScript)
- Gradient overlay: `linear-gradient(to bottom, rgba(15,11,7,0) 0%, rgba(15,11,7,0.15) 50%, rgba(15,11,7,1) 100%)`
- Grain texture overlay at 3% opacity for atmosphere

### Hero Card

- Max-width: 640px, width: 85%
- Border: 3px solid `accent`
- Border-radius: 6px
- Padding: 20px 32px 36px
- Box-shadow: `9px 8px 11px -4px rgba(0,0,0,0.3)` (from legacy CSS)
- Background: `bg` color
- Entry animation: fade-in + 12px translateY on page load

### Avatar

- In card: 140px diameter, circular, 3px `accent` border, overlaps card top by 70px
- Floating (scroll): 44px diameter, fixed top-left (20px, 20px), 2px `accent` border. Appears via scale + opacity transition when hero card scrolls out of view (IntersectionObserver, threshold 0.1).
- **Note:** A properly sized avatar asset is needed for the 44px floating version — the current full-size image is visually squeezed. Production should use two avatar files: one for the card (140px rendered), one for the floating indicator (44px rendered, ideally 88px source for retina).

### Post Cards

- Background: `card-bg`, hover: `inset-bg`
- Border: 1px solid `border`, hover: 1px solid `accent`
- Border-radius: 6px
- Padding: 28px
- Gap between cards: 16px
- Transition: all 0.3s ease

### Project Items

- Left border: 2px solid `border`, hover: 2px solid `accent`
- Padding: 20px 24px
- Gap between items: 8px

### Section Headings

- Centered, TravelingTypewriter, 28px
- 40px wide, 2px tall `accent` underline bar below text (8px gap)

---

## Imagery

### Background

The harbor silhouette (`background.png`) is the primary atmospheric element. It defines the mood of the site: industrial, warm, atmospheric. The image is a posterized/stylized photograph with warm sepia/amber tones.

### Avatar

Cartoon-style avatar (`avatar_small.png`). Brown-toned background matching the brand palette. Displayed in a circular crop with `accent` border.

---

## Component Patterns

### Links

```
Default:  color: #f4e4c0 (link)
Hover:    color: #ae8d67 (hover)
Visited:  color: #f3ca84 (gold)
Active:   color: #be884b (accent)
```

No underline by default. Typewriter font for navigation/UI links, serif for inline content links.

### Tags

Inline-block, bordered pill style. TravelingTypewriter 12px. Color: `accent`. Border: 1px solid `border`. Border-radius: 3px. Padding: 2px 10px.

### Social Icons

22px stroke icons (GitHub, Blog/book, LinkedIn). Color: `muted`, hover: `link`. Stroke-width: 1.5.

### "All Posts" Link

TravelingTypewriter 14px, color: `link`, letter-spacing: 1.5px, uppercase. Accompanied by a diagonal arrow icon. Centered below post cards.

### Text Selection

Background: `accent`. Color: `bg`.

---

## Ghost Theme Direction

The Ghost theme should carry the brand identity into the blog reading experience:

- Same color palette, same font stack
- Post listing page mirrors the "Recent Posts" card style from the landing page
- Single post layout: Source Serif 4 body text, generous line-height (1.8+), max-width ~720px
- Code blocks: `inset-bg` background, JetBrains Mono, with syntax highlighting and copy button
- Tag pages use the same tag pill style
- Navigation uses TravelingTypewriter
- The harbor background is NOT repeated in the Ghost theme — the blog uses solid `bg` color. The atmospheric image is exclusive to the landing page hero.

---

## Open Items

- **Avatar resizing:** Production needs two avatar sizes (140px card, 88px floating for retina). Current single asset works but the floating version appears squeezed.
- **Copy text:** About section and project descriptions are placeholders. Real content to be written before launch.
- **Blog post integration:** Landing page post cards are currently static HTML. Phase 5 will evaluate whether to fetch from Ghost API (JavaScript) or use a build-time approach.
- **Responsive behavior:** Prototype is desktop-focused. Mobile breakpoints and responsive adjustments to be defined during implementation (Session 002).