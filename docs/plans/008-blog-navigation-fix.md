# Session 008 — Blog Navigation Header Fix

## Context

Commit `dadb525 add explicit home link` (current HEAD) replaced the entire
contents of `ghost-theme/partials/navigation.hbs` with a bare `<ul>` containing
only the new hardcoded Home link plus the foreach over `@site.navigation`.

The previous version (introduced in `a7c2cbc`) wrapped that list in
`<header class="site-header"> → <div class="site-header__inner"> → <a class="site-header__title"> + <nav class="site-nav">`. The CSS in
`ghost-theme/assets/css/theme.css:177-227` is built around exactly that
structure (`.site-header`, `.site-header__inner` flex row,
`.site-header__title`, `.site-nav__link`).

Symptom on production: site title "PAUL WERNER" is gone, "HOME" floats
unstyled in the top-left because it has no flex container, no padding, no
typography — none of the `.site-header*` rules can match.

The Home → main-site link itself is correctly hardcoded: Ghost's `{{url}}`
helper relativizes external URLs against `@site.url` (the blog
subdomain), so it cannot be configured through Admin Navigation. The fix
is to restore the wrapper markup while keeping the hardcoded Home `<li>`.

## Change

Single file edit: `ghost-theme/partials/navigation.hbs`.

Restore the full header structure from `a7c2cbc`, then insert the
hardcoded Home `<li>` as the first item inside `.site-nav__list`,
followed by the existing `{{#foreach @site.navigation}}` loop. Drop the
`{{#if @site.navigation}}` gate around `<nav>` — Home is always present,
so the nav must always render.

Target markup:

```hbs
<header class="site-header">
    <div class="site-header__inner">
        <a href="{{@site.url}}" class="site-header__title">{{@site.title}}</a>
        <nav class="site-nav" aria-label="Primary">
            <ul class="site-nav__list">
                {{!-- Hardcoded: Ghost's {{url}} helper relativizes external URLs against @site.url, so the link to the main site cannot be managed via Admin Navigation. --}}
                <li class="site-nav__item"><a class="site-nav__link" href="https://paulwerner.net/">Home</a></li>
                {{#foreach @site.navigation}}
                <li class="site-nav__item"><a class="site-nav__link{{#if current}} is-current{{/if}}" href="{{url}}">{{label}}</a></li>
                {{/foreach}}
            </ul>
        </nav>
    </div>
</header>
```

No CSS changes needed — every class above is already styled in
`theme.css:177-227`, and the existing `.site-header__inner` flex
(`justify-content: space-between`, `flex-wrap: wrap`, `gap: 24px`)
handles the 375px responsive case.

## Manual step (note in session summary, not executed by code)

If a "Home" entry remains in Ghost Admin → Settings → Navigation
(carried over from the abandoned attempt to manage this through Admin),
remove it so it doesn't render twice via the `{{#foreach}}` loop. This
needs to be done by hand in the live admin UI.

## Files

- `ghost-theme/partials/navigation.hbs` — restore wrapper, keep hardcoded Home `<li>`
- `ghost-theme/assets/css/theme.css` — read-only reference, no edits

## Verification

1. Local: `docker compose restart ghost`, open `http://blog.localhost/`,
   confirm "PAUL WERNER" left-aligned and "HOME" right-aligned, both in
   TravelingTypewriter.
2. DevTools at 375px width — header wraps without overflow; Home link
   stays right-aligned (or wraps cleanly under the title via
   `flex-wrap: wrap`).
3. Hover states: title turns `--link`, Home link turns `--link`.
4. Production: commit, push, `git pull` on the VPS, `docker compose
   restart ghost`, sanity-check `https://blog.paulwerner.net` and that
   "Home" routes to `https://paulwerner.net/`.

## Commits

1. `fix(ghost-theme): repair navigation header and Home link`
2. `docs: add session 008 summary` (after acceptance, per CLAUDE.md)
