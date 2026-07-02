import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { dirname, join } from 'node:path';
import express from 'express';
import { loadConfig } from './config.js';
import { computeSlots } from './slots.js';
import { createBusySource } from './busy.js';
import { openDb, SlotTakenError } from './db.js';
import { createMailer } from './mailer.js';
import { createRateLimiter } from './ratelimit.js';

let config;
try {
  config = loadConfig();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const db = openDb(config.dbPath);
const mailer = createMailer({ config });
const busy = createBusySource({
  url: config.busyIcsUrl,
  ttlSeconds: config.busyTtlSeconds,
  horizonDays: config.availability.maxHorizonDays,
});
busy.start();

const DAY_MS = 24 * 3600 * 1000;
function maintenance() {
  try {
    const { deleted } = db.runMaintenance({
      retentionDays: config.retentionDays,
      backupPath: join(dirname(config.dbPath), 'backup', 'bookings.db'),
    });
    if (deleted > 0) console.log(`maintenance: deleted ${deleted} booking(s) past retention`);
  } catch (err) {
    console.error('maintenance failed:', err);
  }
}
maintenance();
setInterval(maintenance, DAY_MS).unref();

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (cleaned.length === 0 || cleaned.length > maxLength) return null;
  return cleaned;
}

function normalizeStart(value) {
  if (typeof value !== 'string') return null;
  const ms = Date.parse(value);
  if (Number.isNaN(ms) || ms % 60000 !== 0) return null;
  return new Date(ms).toISOString().replace('.000Z', 'Z');
}

function tokenMatches(row, token) {
  if (typeof token !== 'string' || token.length === 0) return false;
  const given = createHash('sha256').update(token).digest();
  const stored = Buffer.from(row.manage_token_hash, 'hex');
  return stored.length === given.length && timingSafeEqual(given, stored);
}

// maxBusyAgeSeconds shrinks the double-booking window at booking time by
// forcing a fresher Proton fetch than the regular poll interval.
async function availableSlots({ maxBusyAgeSeconds } = {}) {
  const busyIntervals = await busy.getBusyIntervals(
    maxBusyAgeSeconds ? { maxAgeSeconds: maxBusyAgeSeconds } : {},
  );
  const bookedIntervals = db.confirmedIntervals(new Date().toISOString());
  return computeSlots({ availability: config.availability, busyIntervals, bookedIntervals });
}

const app = express();
// Caddy is the only client; trust its X-Forwarded-For so req.ip is the visitor.
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '4kb' }));

app.get('/api/book/health', (req, res) => {
  res.json({ ok: true, busyFetchedAt: busy.lastFetchedAt(), db: 'ok' });
});

app.get('/api/book/slots', createRateLimiter({ limit: 60, windowMs: 60_000 }), async (req, res, next) => {
  try {
    const slots = await availableSlots();
    res.json({
      slotDurationMinutes: config.availability.slotDurationMinutes,
      ownerTimezone: config.availability.timezone,
      horizonDays: config.availability.maxHorizonDays,
      meetingTitle: config.availability.meeting.title,
      locationNote: config.availability.meeting.locationNote,
      slots,
    });
  } catch (err) {
    // Never had a successful busy fetch — refuse rather than double-book.
    console.error('slots unavailable:', err.message);
    res.status(503).json({ error: 'unavailable' });
  }
});

app.post('/api/book', createRateLimiter({ limit: 5, windowMs: 3600_000 }), async (req, res, next) => {
  try {
    const { website } = req.body ?? {};
    const name = cleanText(req.body?.name, 100);
    const email = cleanText(req.body?.email, 254);
    const note = req.body?.note ? cleanText(req.body.note, 500) : null;
    const start = normalizeStart(req.body?.start);

    if (typeof website === 'string' && website !== '') {
      // Honeypot: pretend success, do nothing.
      return res.status(201).json({ uid: `booking-${randomBytes(16).toString('hex')}`, start: req.body?.start ?? null });
    }
    if (!name) return res.status(422).json({ error: 'validation', field: 'name' });
    if (!email || !EMAIL_RE.test(email)) return res.status(422).json({ error: 'validation', field: 'email' });
    if (req.body?.note && note === null) return res.status(422).json({ error: 'validation', field: 'note' });
    if (!start) return res.status(422).json({ error: 'validation', field: 'start' });

    let slots;
    try {
      slots = await availableSlots({ maxBusyAgeSeconds: 60 });
    } catch (err) {
      console.error('booking refused, busy calendar unavailable:', err.message);
      return res.status(503).json({ error: 'unavailable' });
    }
    if (!slots.includes(start)) return res.status(409).json({ error: 'slot_taken' });

    const domain = new URL(config.publicUrl).hostname;
    const uid = `booking-${randomBytes(16).toString('hex')}@${domain}`;
    const token = randomBytes(24).toString('base64url');
    const end = new Date(Date.parse(start) + config.availability.slotDurationMinutes * 60_000)
      .toISOString()
      .replace('.000Z', 'Z');

    let booking;
    try {
      booking = db.createBooking({
        uid,
        slotStart: start,
        slotEnd: end,
        name,
        email,
        note,
        manageTokenHash: createHash('sha256').update(token).digest('hex'),
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      if (err instanceof SlotTakenError) return res.status(409).json({ error: 'slot_taken' });
      throw err;
    }

    const manageUrl = `${config.publicUrl}/book/manage/?uid=${encodeURIComponent(uid)}&token=${token}`;
    try {
      await mailer.sendBookingEmails({ booking, manageUrl });
    } catch (err) {
      // The booking stands; losing the emails must be visible in the logs.
      console.error(`EMAIL FAILED for ${uid} (${email}, ${start}):`, err);
    }

    res.status(201).json({ uid, start, end, durationMinutes: config.availability.slotDurationMinutes });
  } catch (err) {
    next(err);
  }
});

app.get('/api/book/bookings/:uid', (req, res) => {
  const row = db.getBookingByUid(req.params.uid);
  // Unknown uid and bad token are indistinguishable on purpose.
  if (!row || !tokenMatches(row, req.query.token)) return res.status(404).json({ error: 'not_found' });
  res.json({
    start: row.slot_start,
    end: row.slot_end,
    status: row.status,
    name: row.name,
    meetingTitle: config.availability.meeting.title,
  });
});

app.post('/api/book/bookings/:uid/cancel', createRateLimiter({ limit: 10, windowMs: 3600_000 }), async (req, res, next) => {
  try {
    const row = db.getBookingByUid(req.params.uid);
    if (!row || !tokenMatches(row, req.body?.token)) return res.status(404).json({ error: 'not_found' });
    if (row.status === 'cancelled') return res.json({ status: 'cancelled' });

    const cancelled = db.cancelBooking(row.uid, new Date().toISOString());
    try {
      await mailer.sendCancellationEmails({ booking: cancelled });
    } catch (err) {
      console.error(`EMAIL FAILED for cancellation ${row.uid}:`, err);
    }
    res.json({ status: 'cancelled' });
  } catch (err) {
    next(err);
  }
});

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
    return res.status(400).json({ error: 'bad_request' });
  }
  console.error('unhandled error:', err);
  res.status(500).json({ error: 'internal' });
});

const server = app.listen(config.port, () => {
  console.log(`booking service listening on :${config.port}`);
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    busy.stop();
    server.close(() => process.exit(0));
    // Docker's stop timeout is the real backstop; this keeps shutdown prompt.
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
