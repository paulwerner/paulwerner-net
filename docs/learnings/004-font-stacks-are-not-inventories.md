# 004 — A font stack is not an inventory of fonts that render

## What was assumed

When replacing Google Fonts with self-hosted files, the obvious source of truth
looked like the request being replaced. The pages asked Google for JetBrains
Mono 400/500, Source Serif 4 400/600/700 + italic, and Special Elite; the
Ghost theme asked for JetBrains Mono 400/500 and Source Serif 4 400/600/700. So
self-host exactly those, and the swap is faithful.

## What was discovered

That request had drifted from what the pages actually render, in both
directions, and no single artefact was correct:

- **JetBrains Mono was requested by the landing page and used by nothing.**
  `font-mono` appears nowhere in `site/`. It renders only in the Ghost theme,
  where `theme.css` sets `code` and `pre` in it and `prism.css` styles code
  tokens.
- **Weight 500 was requested in both artefacts and referenced by neither.** The
  weights that do render are 400, 400 italic (Prism comments and italic tokens)
  and 700 (Prism bold tokens) — a set no font request in the repo mentioned.
- **Special Elite looked used because it sat in a font stack.** It appears in
  every `font-typewriter` declaration, second after TravelingTypewriter. But
  TravelingTypewriter is self-hosted from the same origin, so the fallback slot
  is only reachable if that file fails to load. `docs/brand/brand-guidelines.md`
  in fact records Special Elite as the prototype stand-in *for*
  TravelingTypewriter, meaning production never intended to serve both.
- **Tailwind v4's preflight points `code`, `kbd`, `pre` and `samp` at the
  `--font-mono` theme variable.** Leaving JetBrains Mono named in the site's
  token file would have shipped a stylesheet referring to a face that origin
  does not serve — invisible until someone added a `<code>` element.

## The correct approach

Audit fonts by reference site, not by the request being replaced: grep for the
utility class or CSS variable, then find which weights and styles the rules and
templates actually set, then ship exactly that set per artefact. Treat a
fallback stack as a failure path, not as usage — a name in a stack behind a
same-origin font that always loads is dead weight. And check what the CSS
framework's own base layer references, because preflight rules count as usage.

## Generalisable rule

An artefact's dependency list drifts from its real dependencies in both
directions, and copying the old list forward preserves both errors. When
migrating something, derive the new list from what the code references today —
the previous list is a hypothesis to test, not an inventory to trust.
