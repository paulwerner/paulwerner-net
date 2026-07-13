import { DateTime } from 'luxon';

const WEEKDAY_KEYS = { 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat', 7: 'sun' };

const MINUTE = 60 * 1000;

/**
 * The canonical slot-instant format ("YYYY-MM-DDTHH:MM:SSZ"). Every producer
 * and consumer of slot strings (slot list, request normalization, storage)
 * must go through this helper — slot membership and the DB uniqueness index
 * compare these strings byte for byte.
 */
export function toUtcIso(msOrDate) {
  return new Date(msOrDate).toISOString().replace('.000Z', 'Z');
}

function toMs(interval) {
  return {
    start: new Date(interval.start).getTime(),
    end: new Date(interval.end).getTime(),
  };
}

function overlapsAny(start, end, intervals) {
  return intervals.some((iv) => start < iv.end && iv.start < end);
}

/**
 * Pure slot engine: expands the weekly availability windows (wall-clock in
 * the owner timezone, DST-safe via luxon) over the booking horizon and drops
 * every slot whose buffered interval touches a busy or booked interval.
 * Returns sorted UTC ISO strings of slot starts.
 */
export function computeSlots({ availability, busyIntervals = [], bookedIntervals = [], now = new Date() }) {
  const {
    timezone,
    slotDurationMinutes,
    bufferBeforeMinutes,
    bufferAfterMinutes,
    minNoticeHours,
    maxHorizonDays,
    weekly,
    blockedDates,
  } = availability;

  const blocked = busyIntervals.concat(bookedIntervals).map(toMs);
  const blockedDateSet = new Set(blockedDates);
  const nowMs = now.getTime();
  const earliestMs = nowMs + minNoticeHours * 60 * MINUTE;
  const horizonMs = nowMs + maxHorizonDays * 24 * 60 * MINUTE;
  const durationMs = slotDurationMinutes * MINUTE;

  const firstDay = DateTime.fromMillis(nowMs, { zone: timezone }).startOf('day');
  const slots = [];

  for (let i = 0; i <= maxHorizonDays; i++) {
    const day = firstDay.plus({ days: i });
    if (blockedDateSet.has(day.toISODate())) continue;

    for (const win of weekly[WEEKDAY_KEYS[day.weekday]] ?? []) {
      const [startH, startM] = win.start.split(':').map(Number);
      const [endH, endM] = win.end.split(':').map(Number);
      const winEndMs = day.set({ hour: endH, minute: endM }).toMillis();
      let cursor = day.set({ hour: startH, minute: startM });

      while (cursor.toMillis() + durationMs <= winEndMs) {
        const startMs = cursor.toMillis();
        const endMs = startMs + durationMs;
        const fits =
          startMs >= earliestMs &&
          startMs <= horizonMs &&
          !overlapsAny(startMs - bufferBeforeMinutes * MINUTE, endMs + bufferAfterMinutes * MINUTE, blocked);
        if (fits) {
          slots.push(toUtcIso(startMs));
        }
        cursor = cursor.plus({ minutes: slotDurationMinutes });
      }
    }
  }

  return slots.sort();
}
