# Session 011 — Contact CTA Section

## Context

The landing page (`site/index.html`) currently runs Hero → About → Recent Posts → Projects → Footer. There is no call-to-action for visitors who want to reach out about working together; the only contact path is buried in the imprint. This session adds a focused, low-friction CTA between Projects and the footer with a single `mailto:` button.

## Approach

Add one new `<section id="contact">` immediately after `#projects` (closes at site/index.html:154) and before the closing `</main>` at site/index.html:155. Reuse the existing section heading pattern verbatim (TravelingTypewriter 28px, tracking-[2px], centered, with the 40px amber underline bar) so the section blends with About / Recent Posts / Projects.

The button is the only `accent`-filled element on the page, which carries the visual emphasis without any extra subtext.

## Implementation

**File:** `site/index.html` — single insertion between line 154 (`</section>` of `#projects`) and line 155 (`</main>`).

```html
<section id="contact" class="max-w-[720px] mx-auto pt-10 pb-[80px] sm:pb-[100px] px-6">
  <h2 class="font-typewriter text-[28px] tracking-[2px] text-center uppercase">Have a project in mind?</h2>
  <span class="block w-10 h-0.5 bg-accent mx-auto mt-2" aria-hidden="true"></span>

  <div class="text-center mt-12">
    <a href="mailto:contact@paulwerner.net"
       class="inline-block font-typewriter text-[14px] uppercase tracking-[2px] bg-accent text-bg rounded-md px-8 py-3 transition-colors duration-300 hover:bg-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2">
      Let's talk
    </a>
  </div>
</section>
```

**Style notes (matches the spec):**
- Heading reuses the exact classes from `#projects` h2 / underline span (site/index.html:150–151).
- Section spacing `pt-10 pb-[80px] sm:pb-[100px]` mirrors `#projects` so the rhythm is identical.
- Button bg `accent` (#be884b), text `bg` (#0f0b07), hover transitions to `gold` (#f3ca84) over 0.3s — both tokens already exist in the Tailwind config (site/index.html:22, 25).
- `rounded-md` = 6px (matches the hero card / post cards).
- `px-8 py-3` = 32px / 12px, comfortable click target on mobile (375px).
- `tracking-[2px]` matches the "Coming soon" labels and section headings.
- Focus-visible outline matches the pattern used by every other interactive element on the page (see footer links at site/index.html:161–163).

## Out of scope

- No Ghost theme changes — landing-page only.
- No legal-page changes.
- No JS — pure `mailto:` link.

## Verification

1. `docker compose up -d caddy` (or whichever local serve flow is in use) and load `http://localhost/`.
2. Scroll past Projects: confirm the CTA section sits above the footer with matching vertical rhythm.
3. Click "Let's talk" — the OS mail client should open a draft to `contact@paulwerner.net`.
4. Hover the button — background transitions from `accent` to `gold` over ~0.3s.
5. Tab to the button with the keyboard — focus-visible outline appears.
6. Resize to 375px (Chrome devtools mobile) — button is centered, comfortably tappable, no overflow.

## Commits

1. `feat(site): add contact CTA section`
2. `docs: add session 011 summary` (after acceptance, per CLAUDE.md session lifecycle)
