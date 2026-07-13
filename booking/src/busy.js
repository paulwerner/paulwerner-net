import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ical from 'node-ical';
import { DateTime } from 'luxon';

async function defaultLoader(url) {
  if (url.startsWith('file://')) {
    return readFile(fileURLToPath(url), 'utf8');
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000), redirect: 'follow' });
  if (!res.ok) throw new Error(`busy ICS fetch failed: HTTP ${res.status}`);
  return res.text();
}

// All-day (VALUE=DATE) events are parsed by node-ical as UTC midnight with
// datetype 'date'. "Busy all of July 10" means the owner's calendar day, not
// a UTC day, so re-anchor the date to midnight in the owner timezone — else
// the busy block is shifted by the UTC offset (and can miss/over-cover slots
// near midnight or in negative-offset zones).
function zonedDayStart(date, zone) {
  return DateTime.fromObject(
    { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() },
    { zone },
  ).toJSDate();
}

function eventBounds(event, zone) {
  if (event.datetype === 'date') {
    return { start: zonedDayStart(event.start, zone), end: zonedDayStart(event.end, zone) };
  }
  return { start: event.start, end: event.end };
}

function expandEvent(event, windowStart, windowEnd, zone) {
  if (!event.rrule) {
    const { start, end } = eventBounds(event, zone);
    if (end > windowStart && start < windowEnd) {
      return [{ start, end }];
    }
    return [];
  }

  const durationMs = event.end.getTime() - event.start.getTime();

  const exdates = new Set(Object.values(event.exdate ?? {}).map((d) => d.getTime()));
  const overridden = new Set(
    Object.values(event.recurrences ?? {}).map((r) => r.recurrenceid?.getTime()).filter(Boolean),
  );
  const intervals = [];
  // Widen the query window by one duration so occurrences that started
  // before the window but still overlap it are included.
  const queryStart = new Date(windowStart.getTime() - durationMs);
  for (const occurrence of event.rrule.between(queryStart, windowEnd, true)) {
    const t = occurrence.getTime();
    if (exdates.has(t) || overridden.has(t)) continue;
    intervals.push({ start: new Date(t), end: new Date(t + durationMs) });
  }
  for (const override of Object.values(event.recurrences ?? {})) {
    if (override.end > windowStart && override.start < windowEnd) {
      intervals.push({ start: override.start, end: override.end });
    }
  }
  return intervals;
}

function parseBusyIcs(text, windowStart, windowEnd, zone) {
  const parsed = ical.sync.parseICS(text);
  const intervals = [];
  for (const item of Object.values(parsed)) {
    if (item.type !== 'VEVENT' || !item.start || !item.end) continue;
    intervals.push(...expandEvent(item, windowStart, windowEnd, zone));
  }
  return intervals;
}

// Beyond this age, stale busy data is worse than refusing bookings: a
// revoked/rotated share link would otherwise degrade double-booking
// protection indefinitely with only a log line as evidence.
const HARD_STALE_LIMIT_MS = 24 * 3600 * 1000;

/**
 * Polling cache over the secret Proton "share via link" busy ICS.
 * Serves stale data when a refresh fails, but fails closed (throws) if no
 * fetch has ever succeeded or the cache is older than the hard stale limit —
 * callers must treat that as "cannot book now".
 */
export function createBusySource({ url, ttlSeconds, horizonDays, timezone = 'UTC', loader = defaultLoader, now = () => new Date() }) {
  let cache = null;
  let timer = null;
  let inflight = null;

  async function refresh() {
    const text = await loader(url);
    const at = now();
    const windowEnd = new Date(at.getTime() + (horizonDays + 1) * 24 * 3600 * 1000);
    cache = { intervals: parseBusyIcs(text, at, windowEnd, timezone), fetchedAt: at };
  }

  // Concurrent callers share one fetch instead of hammering the Proton link.
  function refreshShared() {
    inflight ??= refresh().finally(() => {
      inflight = null;
    });
    return inflight;
  }

  function ageMs() {
    return cache ? now().getTime() - cache.fetchedAt.getTime() : Infinity;
  }

  return {
    async getBusyIntervals({ maxAgeSeconds = ttlSeconds } = {}) {
      if (ageMs() > maxAgeSeconds * 1000) {
        try {
          await refreshShared();
        } catch (err) {
          if (ageMs() > HARD_STALE_LIMIT_MS) throw err;
          console.error(`busy ICS refresh failed, serving stale data from ${cache.fetchedAt.toISOString()}:`, err.message);
        }
      }
      return cache.intervals;
    },
    lastFetchedAt() {
      return cache?.fetchedAt ?? null;
    },
    start() {
      refreshShared().catch((err) => console.error('initial busy ICS fetch failed:', err.message));
      timer = setInterval(
        () => refreshShared().catch((err) => console.error('busy ICS poll failed:', err.message)),
        ttlSeconds * 1000,
      );
      timer.unref();
    },
    stop() {
      if (timer) clearInterval(timer);
    },
  };
}
