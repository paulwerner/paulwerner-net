# 002 — Ghost's `?v=` asset hash is per-theme-version, not per-file-content

## What was assumed

Ghost's `{{asset}}` Handlebars helper appends a `?v=<hash>` query string to every asset URL (`theme.css?v=abc123`, `prism.css?v=abc123`, etc.). It was assumed this hash was content-addressed — i.e. derived from the file's contents or mtime — so that editing `theme.css` in the bind-mounted theme directory would automatically produce a new URL on the next request and bust browser caches.

Combined with the assets being served with `Cache-Control: public, max-age=31536000` (one year), this assumption seemed safe: a year-long cache is fine if the URL changes whenever the file changes.

## What was discovered

The hash is **per-Ghost-instance, derived from the active theme's package.json `version`**, not from individual file contents. Editing `theme.css` (or any other file inside the theme directory) does **not** change the hash. Restarting the Ghost container does not change it either. Only one of the following will:

- Bumping `version` in `ghost-theme/package.json` and re-activating the theme in Admin
- Re-uploading the theme as a zip via Admin

When the hash doesn't change, every browser that ever loaded the page keeps using its cached `theme.css?v=<old-hash>` for the next year — even after the file on disk has changed and even though `curl` shows the new content. Incognito only escapes this if the incognito session has never loaded the old URL.

This bit hard during debugging: we deployed a fix, observed via `curl` that the served CSS contained the new rule, and yet every browser (including new incognito sessions on different machines) showed the old layout.

## The correct approach

Whenever theme CSS, JS, or other bind-mounted assets are edited, **bump `ghost-theme/package.json` `version`** and re-activate the theme in Admin (`/ghost/#/settings/design`) as part of the deploy ritual. Without that, the `?v=` query stays the same and clients keep their year-cached old asset.

A package.json version bump is also harmless when it isn't strictly needed — it just produces a new hash and forces all clients to refetch. So when in doubt, bump.

## Generalizable rule

Trust observed cache-busting behavior, not what a hash *looks like* it should mean. A `?v=<random-looking-string>` query is not necessarily content-addressed; many systems (Ghost, Rails sprockets in some configs, custom frameworks) use a build-time or instance-level token instead. When a deployed asset change isn't reaching browsers, the first thing to check is whether the URL the browser is requesting actually differs from the previously-cached one — `curl` confirming new content at the same URL is meaningless if browsers keep reading their stale local copy.

For long `Cache-Control` lifetimes (months/years) to be safe, the URL hash must be content-derived. If it isn't, either shorten the cache lifetime or commit to a manual cache-bust step on every asset change.
