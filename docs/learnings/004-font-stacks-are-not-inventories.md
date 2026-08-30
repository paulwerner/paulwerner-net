# 004 — A font stack is not an inventory of fonts that render

**Assumed:** when replacing Google Fonts with self-hosted files, the request being replaced is the source of truth — self-host exactly what was requested and the swap is faithful.

**Discovered:** the request had drifted from what the pages actually render, in both directions:

- JetBrains Mono was requested by the landing page and used by nothing there; it renders only in the Ghost theme (`code`/`pre`, Prism tokens).
- Weight 500 was requested by both artefacts and referenced by neither, while the weights that do render (400, 400 italic, 700) appeared in no request.
- Special Elite sat in every `font-typewriter` stack, but only as the fallback behind self-hosted TravelingTypewriter — and the brand guidelines record it as the prototype stand-in for that very face. A fallback slot behind a same-origin font that always loads is a failure path, not usage.
- Tailwind's preflight points `code`/`kbd`/`pre`/`samp` at `--font-mono`, so a face named there counts as referenced even when no page shows code.

**Correct approach:** derive the font set per artefact from what the code references today — grep the utility classes and CSS variables, find the weights and styles the rules actually set, ship exactly that. The old list is a hypothesis to test, not an inventory to trust. This generalises: any migrated dependency list drifts in both directions, and copying it forward preserves both errors.
