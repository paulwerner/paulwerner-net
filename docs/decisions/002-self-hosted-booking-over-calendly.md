# Decision 002 — Self-Hosted Appointment Booking over Calendly / Cal.com

**Date:** 2026-07-02
**Status:** Accepted

## Context

Prospects should be able to book appointments directly from the landing page. The calendar of record is Proton Calendar. Options considered:

1. **Calendly (SaaS)** — polished, but a paid subscription for a feature set far beyond what a personal site needs, no Proton Calendar support anyway (Google/Outlook/iCloud only), and it hands prospect data to a third party.
2. **Self-hosted Cal.com** — open source, but a heavy multi-container deployment (Next.js app + Postgres + background workers) sized for teams; no Proton Calendar integration either.
3. **Custom minimal service (chosen)** — a single small Node.js container that does exactly four things: compute free slots, poll Proton busy times, store bookings, send emails.

## Decision

Build a custom booking service. Key shape:

- **Proton sync strategy** (the deciding constraint — Proton Calendar has no API and no CalDAV, by design):
  - *Busy times out of Proton:* poll the secret "share calendar via link" ICS URL (busy-only Limited view). Proton caches this link; changes can lag minutes to a few hours.
  - *Bookings into Proton:* email a `METHOD:REQUEST` ICS invite to the owner's Proton address — Proton Mail auto-adds invites to Proton Calendar (default-on setting), including updates and cancellations. ICS-URL subscription in the other direction refreshes only every 8–16 h and was rejected.
- **Instant confirmation** (Calendly-like) rather than owner approval. The busy-ICS lag leaves a small double-booking window for events created directly in Proton Calendar shortly before a booking; accepted deliberately, mitigated by a 24 h minimum-notice default, a 5-minute poll interval, and a forced fresh ICS fetch at booking time.
- **Node.js + Express + SQLite (better-sqlite3)**, not MySQL: bookings are a few rows per week; a separate SQLite file keeps the service self-contained, keeps MySQL scoped to Ghost, and makes backup a file copy. Race safety comes from a partial unique index on confirmed slot starts inside a synchronous transaction.
- **Email via Proton SMTP submission** (`smtp.protonmail.ch:587`, SMTP token, custom-domain sender). Deliberately separate env namespace (`BOOKING_*`) from `GHOST_MAIL_*`, which stays reserved for a future newsletter bulk provider.
- **Availability as a committed config file** (`booking/config/availability.yml`) instead of an admin UI: versioned, no auth surface to build or secure.
- **Exposure only through Caddy** (`/api/book/*` on the root domain); no published host ports, per the firewall posture in decision 001.

## Consequences

- No third-party booking vendor, no subscription, prospect data stays on the VPS.
- The `booking_data` volume (SQLite) must join the host backup routine once the backup script exists; the service writes a crash-consistent copy to `/data/backup/bookings.db` nightly via `VACUUM INTO`.
- Availability changes require an edit + `docker compose restart booking` (no live admin UI).
- If Proton ever ships CalDAV or a calendar API, the busy poller and invite mailer are the only two modules to swap.
