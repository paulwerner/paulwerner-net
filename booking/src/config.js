import { readFileSync } from 'node:fs';
import { DateTime } from 'luxon';
import YAML from 'yaml';

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

class ConfigError extends Error {}

function fail(message) {
  throw new ConfigError(`config: ${message}`);
}

function requireEnv(env, key) {
  const value = env[key];
  if (!value) fail(`missing required environment variable ${key}`);
  return value;
}

function intEnv(env, key, fallback) {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < 0) fail(`${key} must be a non-negative integer, got "${raw}"`);
  return value;
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function validateWindows(day, windows) {
  if (!Array.isArray(windows)) fail(`weekly.${day} must be a list of { start, end } windows`);
  for (const win of windows) {
    if (!win || !TIME_RE.test(win.start ?? '') || !TIME_RE.test(win.end ?? '')) {
      fail(`weekly.${day} windows need start/end as HH:MM, got ${JSON.stringify(win)}`);
    }
    if (toMinutes(win.start) >= toMinutes(win.end)) {
      fail(`weekly.${day} window ${win.start}–${win.end} must start before it ends`);
    }
  }
  const sorted = [...windows].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  for (let i = 1; i < sorted.length; i++) {
    if (toMinutes(sorted[i].start) < toMinutes(sorted[i - 1].end)) {
      fail(`weekly.${day} windows ${sorted[i - 1].start}–${sorted[i - 1].end} and ${sorted[i].start}–${sorted[i].end} overlap`);
    }
  }
  return sorted;
}

export function parseAvailability(yamlText) {
  const raw = YAML.parse(yamlText);
  if (!raw || typeof raw !== 'object') fail('availability file is empty or not a mapping');

  const timezone = raw.timezone;
  if (!timezone || !DateTime.now().setZone(timezone).isValid) {
    fail(`timezone "${timezone}" is not a valid IANA timezone`);
  }

  const slotDurationMinutes = raw.slot_duration_minutes;
  if (!Number.isInteger(slotDurationMinutes) || slotDurationMinutes <= 0) {
    fail('slot_duration_minutes must be a positive integer');
  }
  for (const key of ['buffer_before_minutes', 'buffer_after_minutes', 'min_notice_hours']) {
    if (!Number.isInteger(raw[key] ?? 0) || (raw[key] ?? 0) < 0) fail(`${key} must be a non-negative integer`);
  }
  if (!Number.isInteger(raw.max_horizon_days) || raw.max_horizon_days <= 0) {
    fail('max_horizon_days must be a positive integer');
  }

  if (!raw.meeting?.title || typeof raw.meeting.title !== 'string') fail('meeting.title is required');

  const weekly = {};
  for (const [day, windows] of Object.entries(raw.weekly ?? {})) {
    if (!WEEKDAYS.includes(day)) fail(`weekly contains unknown day "${day}" (use ${WEEKDAYS.join('/')})`);
    weekly[day] = validateWindows(day, windows);
  }
  if (Object.values(weekly).every((w) => w.length === 0)) fail('weekly defines no availability at all');

  const blockedDates = (raw.blocked_dates ?? []).map((d) => {
    const str = d instanceof Date ? DateTime.fromJSDate(d, { zone: 'utc' }).toISODate() : String(d);
    if (!DATE_RE.test(str)) fail(`blocked_dates entry "${d}" is not a YYYY-MM-DD date`);
    return str;
  });

  return {
    timezone,
    slotDurationMinutes,
    bufferBeforeMinutes: raw.buffer_before_minutes ?? 0,
    bufferAfterMinutes: raw.buffer_after_minutes ?? 0,
    minNoticeHours: raw.min_notice_hours ?? 0,
    maxHorizonDays: raw.max_horizon_days,
    meeting: {
      title: raw.meeting.title,
      locationNote: raw.meeting.location_note ?? '',
    },
    weekly,
    blockedDates,
  };
}

export function loadConfig(env = process.env) {
  const availabilityPath = env.BOOKING_AVAILABILITY_PATH ?? '/app/availability.yml';
  let yamlText;
  try {
    yamlText = readFileSync(availabilityPath, 'utf8');
  } catch (err) {
    fail(`cannot read availability file at ${availabilityPath}: ${err.message}`);
  }

  return {
    port: intEnv(env, 'BOOKING_PORT', 3000),
    publicUrl: requireEnv(env, 'BOOKING_PUBLIC_URL').replace(/\/$/, ''),
    ownerEmail: requireEnv(env, 'BOOKING_OWNER_EMAIL'),
    fromAddress: requireEnv(env, 'BOOKING_FROM_ADDRESS'),
    smtp: {
      host: requireEnv(env, 'BOOKING_SMTP_HOST'),
      port: intEnv(env, 'BOOKING_SMTP_PORT', 587),
      // Empty user disables SMTP AUTH (dev sinks like mailpit have none).
      user: env.BOOKING_SMTP_USER ?? '',
      password: env.BOOKING_SMTP_PASSWORD ?? '',
    },
    busyIcsUrl: requireEnv(env, 'BOOKING_BUSY_ICS_URL'),
    busyTtlSeconds: intEnv(env, 'BOOKING_BUSY_TTL_SECONDS', 300),
    retentionDays: intEnv(env, 'BOOKING_RETENTION_DAYS', 90),
    dbPath: env.BOOKING_DB_PATH ?? '/data/bookings.db',
    availability: parseAvailability(yamlText),
  };
}
