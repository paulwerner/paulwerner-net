import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ical from 'node-ical';

async function defaultLoader(url) {
  if (url.startsWith('file://')) {
    return readFile(fileURLToPath(url), 'utf8');
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000), redirect: 'follow' });
  if (!res.ok) throw new Error(`busy ICS fetch failed: HTTP ${res.status}`);
  return res.text();
}

function expandEvent(event, windowStart, windowEnd) {
  const durationMs = event.end.getTime() - event.start.getTime();
  if (!event.rrule) {
    if (event.end > windowStart && event.start < windowEnd) {
      return [{ start: event.start, end: event.end }];
    }
    return [];
  }

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

function parseBusyIcs(text, windowStart, windowEnd) {
  const parsed = ical.sync.parseICS(text);
  const intervals = [];
  for (const item of Object.values(parsed)) {
    if (item.type !== 'VEVENT' || !item.start || !item.end) continue;
    intervals.push(...expandEvent(item, windowStart, windowEnd));
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
export function createBusySource({ url, ttlSeconds, horizonDays, loader = defaultLoader, now = () => new Date() }) {
  let cache = null;
  let timer = null;
  let inflight = null;

  async function refresh() {
    const text = await loader(url);
    const at = now();
    const windowEnd = new Date(at.getTime() + (horizonDays + 1) * 24 * 3600 * 1000);
    cache = { intervals: parseBusyIcs(text, at, windowEnd), fetchedAt: at };
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
