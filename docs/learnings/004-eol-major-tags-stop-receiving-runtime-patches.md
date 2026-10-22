# EOL Major Image Tags Stop Receiving Runtime Patches

The blog referenced `ghost:5-alpine`, and the assumption was that a floating major tag keeps picking up security rebuilds of the underlying runtime. That holds only while the major version is maintained. When Ghost 5 went end of life, its directory was removed from the official image repo (February 2026). The tag stayed pullable but was never rebuilt, and it stayed frozen on Node v20.20.0. When the Node.js security release of 2026-10-21 shipped a Brotli RCE fix, the site was affected with no image-level fix available. Nothing in `docker compose pull` output signals this.

The correct approach is to treat the EOL date of every pinned major (Ghost, MySQL, Caddy) as a scheduled task, not a surprise. When a runtime CVE drops, check what the container actually runs (`docker compose exec ghost node -v`) and when the tag was last pushed (Docker Hub "last updated"), rather than trusting the tag name.
