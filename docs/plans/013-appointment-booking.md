# Session 013 — Self-Hosted Appointment Booking with Proton Calendar Sync

## Context

The landing page's only contact path is the `mailto:` CTA added in session 011. Prospects should be able to book appointments directly — Calendly-like, but self-hosted: no third-party booking suite, no subscription. Requirements: a CTA at the bottom of the landing page → a brand-matched booking screen showing available slots → slots respect configured availability **and** the owner's Proton Calendar; confirmed bookings must appear in Proton Calendar.

**The Proton constraint (verified, drives the architecture):** Proton Calendar has no API and no CalDAV. Only two integration surfaces exist:

- **Busy times out:** "Share calendar via link" — a secret read-only ICS URL (busy-only "Limited view"). Proton caches it; changes can lag minutes to a few hours.
- **Bookings in:** Proton Mail **auto-adds emailed ICS invites** (`METHOD:REQUEST`) to Proton Calendar (default on), including updates and cancellations. Near real-time. (ICS-URL subscription the other way refreshes only every 8–16 h — unusable.)

**Settled decisions (see decision record 002):**

1. Email via **Proton SMTP submission** (`smtp.protonmail.ch:587`, SMTP token, sender `bookings@paulwerner.net`). `BOOKING_*` env vars kept **separate** from `GHOST_MAIL_*` (reserved for a future newsletter provider).
2. **Instant confirmation**; small double-booking risk from busy-ICS lag accepted, mitigated by min-notice + polling + fresh re-fetch at booking time.
3. Availability via **config file** (`booking/config/availability.yml`), bind-mounted.
4. **Node.js** backend, **SQLite** (better-sqlite3) — not MySQL. Small Alpine image.

## Architecture

```
Visitor ──> paulwerner.net/book/              (static page, Caddy file_server)
              │ fetch()
              ▼
        paulwerner.net/api/book/*             (Caddy reverse_proxy → booking:3000)
              ▼
        booking service (node:22-alpine, Express, 4th compose service on `web` net)
          - slot engine (availability.yml, luxon for DST-safe Europe/Berlin→UTC)
          - Proton busy-ICS poller (node-ical, in-memory cache, TTL 5 min,
            forced fresh fetch at booking time; fail closed if never fetched)
          - SQLite at /data/bookings.db (named volume booking_data, WAL mode)
          - nodemailer → smtp.protonmail.ch:587
```

No published host ports (firewall allows only 22/80/443 — decision 001). Libraries: **express** (routing/JSON plumbing), **node-ical** (parses Proton ICS incl. RRULE expansion), **luxon** (DST-safe tz math), **yaml**, **hand-rolled ICS generation** (~60 lines — the `ics` npm package handles METHOD/SEQUENCE/PARTSTAT poorly, and those fields are exactly what Proton auto-add depends on; UTC DTSTART/DTEND avoids VTIMEZONE).

## Files

**Create:**

- `booking/Dockerfile` — multi-stage node:22-alpine (builder has python3/make/g++ for better-sqlite3 musl-prebuild misses)
- `booking/package.json` — express, better-sqlite3, nodemailer, node-ical, luxon, yaml; `node --test`
- `booking/config/availability.yml` — committed config (no secrets)
- `booking/src/server.js` (app wiring, graceful shutdown), `config.js` (env + yaml load, fail-fast validation), `slots.js` (pure slot engine), `busy.js` (ICS poller, `file://` support for dev fixtures), `db.js` (schema, CRUD, retention job), `ics.js` (REQUEST/CANCEL builder, folding/escaping), `mailer.js`, `ratelimit.js` (in-memory per-IP, trusts X-Forwarded-For from Caddy)
- `booking/test/slots.test.js` (incl. DST-transition dates), `booking/test/fixtures/busy.ics` (mimics Proton Limited view, incl. one RRULE event)
- `site/book/index.html` — booking page (follows the legal sub-page duplication recipe)
- `site/book/manage/index.html` — cancel page (from confirmation-email link)
- `docker-compose.dev.yml` — dev overlay: mailpit (`axllent/mailpit`, UI :8025), fixture ICS URL. Never deployed.
- `docs/plans/013-appointment-booking.md`, `docs/decisions/002-self-hosted-booking-over-calendly.md`
- `docs/sessions/013-*.md` — only after acceptance

**Modify:**

- `docker-compose.yml` — `booking` service + `booking_data` volume; caddy `depends_on` += booking
- `Caddyfile` — in `{$DOMAIN}` block: `reverse_proxy /api/book/* booking:3000` (Caddy's default directive order runs it before `file_server`)
- `.env.example` — `BOOKING_*` block
- `site/index.html` — `#contact`: primary accent button becomes "Book an appointment" → `/book/`; mailto demoted to muted secondary link
- `site/privacy/index.html` — "Appointment Booking" GDPR section + bump Last updated
- `CLAUDE.md` — architecture diagram, directory tree, stack notes (end of session)

## Config

**`.env.example` additions** (deliberately separate from `GHOST_MAIL_*`):

```
BOOKING_SMTP_HOST=smtp.protonmail.ch
BOOKING_SMTP_PORT=587
BOOKING_SMTP_USER=bookings@paulwerner.net
BOOKING_SMTP_PASSWORD=change-me            # Proton SMTP token, not a password
BOOKING_FROM_ADDRESS=bookings@paulwerner.net
BOOKING_OWNER_EMAIL=change-me@proton.me    # receives invites; Proton auto-adds to calendar
BOOKING_BUSY_ICS_URL=https://calendar.proton.me/api/calendar/v1/url/…  # secret share link
BOOKING_BUSY_TTL_SECONDS=300
BOOKING_RETENTION_DAYS=90
```

Compose passes these through plus `BOOKING_PUBLIC_URL=https://${DOMAIN}`; healthcheck `wget -qO- http://localhost:3000/api/book/health`. Note learning 003: env changes need `up -d`, not `restart`.

**`booking/config/availability.yml`:**

```yaml
timezone: Europe/Berlin
slot_duration_minutes: 30
buffer_before_minutes: 0
buffer_after_minutes: 15
min_notice_hours: 24
max_horizon_days: 30
meeting:
  title: "Intro call"            # ICS SUMMARY becomes "Intro call — <name>"
  location_note: "Video call — I'll send a meeting link before we talk."
weekly:                          # wall-clock in `timezone`; omitted day = unavailable
  mon: [{ start: "10:00", end: "12:00" }, { start: "14:00", end: "17:00" }]
  tue: [{ start: "10:00", end: "17:00" }]
blocked_dates: [2026-08-10]
```

Validated at boot (bad HH:MM, unknown tz, overlapping windows → fail fast). Re-read on `docker compose restart booking`.

## SQLite schema & race safety

```sql
CREATE TABLE bookings (
  id INTEGER PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,                -- booking-<128-bit-random>@paulwerner.net
  slot_start TEXT NOT NULL, slot_end TEXT NOT NULL,   -- UTC ISO 8601
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','cancelled')),
  name TEXT NOT NULL, email TEXT NOT NULL, note TEXT,
  manage_token_hash TEXT NOT NULL,         -- sha256(token); raw token only in email link
  ics_sequence INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, cancelled_at TEXT
);
CREATE UNIQUE INDEX uq_active_slot ON bookings (slot_start) WHERE status = 'confirmed';
```

Booking insert in a `db.transaction()`: re-validate (fresh busy fetch if cache > 60 s old) → INSERT; racing loser's INSERT throws on the partial unique index → `409 slot_taken`. Nightly job: delete rows with `slot_end < now − RETENTION_DAYS`; `VACUUM INTO /data/backup/bookings.db` for a crash-consistent backup copy.

## API (`/api/book`)

- `GET /health` → `{ ok, busyFetchedAt, db }`
- `GET /slots` → `{ slotDurationMinutes, ownerTimezone, horizonDays, slots: ["2026-07-06T08:00:00Z", …] }`
- `POST /` → body `{ start, name, email, note?, website: "" }` (honeypot must be empty; hit → fake 201, no side effects) → `201 { uid, start, end }` | `409 slot_taken` | `422` | `429` | `503` (no successful busy fetch ever → fail closed)
- `GET /bookings/:uid?token=…` → details | `404` (wrong uid or token — no oracle)
- `POST /bookings/:uid/cancel` `{ token }` → `200` | `404`

Slot engine (pure, unit-tested): expand weekly windows per day over `[now+min_notice, now+horizon]` in owner tz → UTC (luxon), cut into slot steps, drop slots whose `[start−buffer_before, end+buffer_after]` overlaps Proton busy intervals or confirmed bookings, drop blocked dates. Limits: name ≤ 100, email ≤ 254 + shape, note ≤ 500; rate limit POST 5/h/IP, GET /slots 60/min/IP. Reschedule = cancel + rebook (v1 simplicity).

## ICS invite (the Proton-sync core)

Same VEVENT to both parties, `METHOD:REQUEST` (via nodemailer `icalEvent`):

```
UID:booking-<random>@paulwerner.net    SEQUENCE:0
DTSTART/DTEND: UTC                     SUMMARY:<meeting.title> — <prospect name>
LOCATION:<meeting.location_note>
DESCRIPTION: booked via paulwerner.net + note + manage link
ORGANIZER;CN=paulwerner.net bookings:mailto:bookings@paulwerner.net
ATTENDEE;…PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:<BOOKING_OWNER_EMAIL>
ATTENDEE;…PARTSTAT=ACCEPTED:mailto:<prospect>
```

Owner's Proton address as ATTENDEE (organizer must be a different address) → Proton auto-adds. Prospect as attendee → Gmail/Outlook render "Add to calendar". Cancel: same UID, `SEQUENCE:1`, `METHOD:CANCEL`, `STATUS:CANCELLED` to both → Proton auto-removes.

**Wrinkle to verify in prod smoke test:** if `bookings@` lives on the same Proton account as the owner address, Proton may treat the invite as self-organized and skip auto-add. Fallback: set ORGANIZER to the prospect's mailto (From header stays `bookings@`). Record outcome in a learnings doc.

**Email flows:** booking → owner gets notification + invite ICS; prospect gets confirmation (time in their tz and CET) + same ICS + manage link `https://paulwerner.net/book/manage/?uid=…&token=…`. Cancel → METHOD:CANCEL to both. Plain-text bodies. Send happens after DB commit; send failure logs loudly but doesn't roll back.

## Frontend UX

`site/book/index.html` (vanilla JS, same pattern as the Ghost Content API fetch on index.html; no month grid — 30-day horizon doesn't warrant one):

1. **Day strip** — horizontally scrollable chips ("Mon 6 Jul (4)"), only days with slots, grouped by *visitor-local* date (`Intl.DateTimeFormat`); styled like existing tag pills, selected = accent.
2. **Slot grid** for the selected day, visitor-local times; note "Times shown in your timezone (…)".
3. **Form card** (name, email, optional note, hidden honeypot) in `card-bg` card style; accent CTA "Confirm booking".
4. **Success state** with both timezones + "check your email". `409` → "That slot was just taken", re-fetch slots.

`site/book/manage/index.html`: reads uid/token from query, shows booking, confirm-cancel, links back to `/book/` to rebook.

## Verification

1. **Unit:** `node --test booking/test/` — DST switch dates, min-notice boundary, buffers, blocked dates, booked-slot exclusion, fixture busy ICS with RRULE.
2. **Local integration:** `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d` — fixture ICS via `file://`, SMTP → mailpit (localhost:8025).
3. **Manual:** `/book/` shows slots minus fixture busy times; book → both emails in mailpit with valid ICS; two racing `curl -X POST` → one 201 one 409; cancel via manage link → METHOD:CANCEL; health endpoint; honeypot + rate-limit responses.
4. **Prod smoke (post-deploy):** one real booking — invite auto-appears in Proton Calendar; a Proton-created event hides slots (allow for share-link lag); cancel propagates. Document organizer/attendee finding.

## Commits (each independently committable)

1. `docs: add plan 013 and decision record 002`
2. `feat(booking): scaffold Node service with config loading and health endpoint`
3. `feat(infra): wire booking service into compose and Caddy`
4. `feat(booking): slot computation engine with unit tests`
5. `feat(booking): Proton busy-ICS poller with cache and fixture support`
6. `feat(booking): SQLite storage with race-safe slot uniqueness and retention`
7. `feat(booking): ICS invite generation and email flows via Proton SMTP`
8. `feat(booking): public API — slots, book, manage, cancel`
9. `feat(site): booking page with day strip and slot picker`
10. `feat(site): booking manage/cancel page`
11. `feat(site): landing CTA links to booking page`
12. `docs(site): privacy policy addendum for appointment booking`
13. `docs: update CLAUDE.md architecture and directory structure`
14. Session summary + learnings — after acceptance only

## Open risks

- **Busy-ICS lag** (minutes–hours): fresh Proton events may not block slots immediately — accepted; mitigated by 24 h min-notice, 5-min poll, fresh fetch at booking.
- **Share-link revocation:** polling fails → stale cache served, health flags it; fail closed if never fetched.
- **Same-account organizer wrinkle:** fallback documented above.
- **SMTP token:** `.env` only (gitignored), single-address scope, rotatable in Proton settings.
- **Owner setup prerequisites (manual, outside repo):** create `bookings@paulwerner.net` address + SMTP token in Proton; create the busy-only share link in Proton Calendar; keep "auto-add invitations" enabled.
