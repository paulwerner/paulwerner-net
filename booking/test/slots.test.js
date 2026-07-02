import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeSlots } from '../src/slots.js';
import { parseAvailability } from '../src/config.js';

// Post-parse availability shape (see config.js); overridable per test.
function availability(overrides = {}) {
  return {
    timezone: 'Europe/Berlin',
    slotDurationMinutes: 30,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    minNoticeHours: 24,
    maxHorizonDays: 30,
    weekly: {
      thu: [{ start: '10:00', end: '17:00' }],
    },
    blockedDates: [],
    ...overrides,
  };
}

// Wed 2026-07-01 12:00 UTC — Berlin is UTC+2, so Thu windows 10:00–17:00
// local are 08:00Z–15:00Z.
const NOW = new Date('2026-07-01T12:00:00Z');

test('respects min notice and window end', () => {
  const slots = computeSlots({ availability: availability({ maxHorizonDays: 2 }), now: NOW });
  // Earliest allowed instant is Thu 12:00Z; last slot must END by 15:00Z.
  assert.equal(slots[0], '2026-07-02T12:00:00Z');
  assert.equal(slots.at(-1), '2026-07-02T14:30:00Z');
  assert.equal(slots.length, 6);
});

test('slot exactly at the min-notice boundary is included', () => {
  const slots = computeSlots({ availability: availability({ maxHorizonDays: 2 }), now: new Date('2026-07-01T08:00:00Z') });
  assert.ok(slots.includes('2026-07-02T08:00:00Z'));
  assert.ok(!slots.includes('2026-07-02T07:30:00Z'));
});

test('busy interval with buffer_after blocks adjacent earlier slot', () => {
  const avail = availability({ maxHorizonDays: 2, bufferAfterMinutes: 15 });
  // Busy Thu 12:00Z–13:00Z. With a 15 min after-buffer the 11:30Z slot
  // (padded to 12:15Z) collides too; 11:00Z survives (padded end 11:45Z).
  const busy = [{ start: '2026-07-02T12:00:00Z', end: '2026-07-02T13:00:00Z' }];
  const slots = computeSlots({ availability: avail, busyIntervals: busy, now: new Date('2026-07-01T08:00:00Z') });
  assert.ok(slots.includes('2026-07-02T11:00:00Z'));
  assert.ok(!slots.includes('2026-07-02T11:30:00Z'));
  assert.ok(!slots.includes('2026-07-02T12:00:00Z'));
  assert.ok(!slots.includes('2026-07-02T12:30:00Z'));
  assert.ok(slots.includes('2026-07-02T13:00:00Z'));
});

test('buffer_before blocks the slot right after a busy interval', () => {
  const avail = availability({ maxHorizonDays: 2, bufferBeforeMinutes: 30 });
  const busy = [{ start: '2026-07-02T12:00:00Z', end: '2026-07-02T13:00:00Z' }];
  const slots = computeSlots({ availability: avail, busyIntervals: busy, now: new Date('2026-07-01T08:00:00Z') });
  assert.ok(!slots.includes('2026-07-02T13:00:00Z'));
  assert.ok(slots.includes('2026-07-02T13:30:00Z'));
});

test('confirmed bookings block their slot', () => {
  const booked = [{ start: '2026-07-02T12:00:00Z', end: '2026-07-02T12:30:00Z' }];
  const slots = computeSlots({ availability: availability({ maxHorizonDays: 2 }), bookedIntervals: booked, now: NOW });
  assert.ok(!slots.includes('2026-07-02T12:00:00Z'));
  assert.ok(slots.includes('2026-07-02T12:30:00Z'));
});

test('blocked date removes the whole day', () => {
  const slots = computeSlots({
    availability: availability({ maxHorizonDays: 2, blockedDates: ['2026-07-02'] }),
    now: NOW,
  });
  assert.deepEqual(slots, []);
});

test('days without weekly windows yield nothing', () => {
  // Horizon of 1 day from Wednesday reaches only Wed+Thu; weekly has thu only.
  const slots = computeSlots({ availability: availability({ maxHorizonDays: 1, minNoticeHours: 0 }), now: NOW });
  assert.ok(slots.length > 0);
  assert.ok(slots.every((s) => s.startsWith('2026-07-02T') || s.startsWith('2026-07-01T')));
});

test('no slots beyond the horizon', () => {
  const slots = computeSlots({ availability: availability({ maxHorizonDays: 7 }), now: NOW });
  const horizon = new Date('2026-07-08T12:00:00Z').getTime();
  assert.ok(slots.every((s) => new Date(s).getTime() <= horizon));
});

test('DST spring-forward: nonexistent wall-clock hour is skipped safely', () => {
  // Berlin skips 02:00–03:00 on Sun 2026-03-29. A 01:00–05:00 window holds
  // 3 real hours, so 3 hourly slots — never 4, never a phantom 02:00.
  const avail = availability({
    slotDurationMinutes: 60,
    minNoticeHours: 0,
    maxHorizonDays: 2,
    weekly: { sun: [{ start: '01:00', end: '05:00' }] },
  });
  const slots = computeSlots({ availability: avail, now: new Date('2026-03-28T12:00:00Z') });
  assert.deepEqual(slots, [
    '2026-03-29T00:00:00Z', // 01:00 CET
    '2026-03-29T01:00:00Z', // 03:00 CEST (02:00 does not exist)
    '2026-03-29T02:00:00Z', // 04:00 CEST
  ]);
});

test('DST fall-back: repeated wall-clock hour yields real 4-hour window', () => {
  // Berlin repeats 02:00–03:00 on Sun 2026-10-25. A 01:00–04:00 window is
  // 4 absolute hours, so 4 hourly slots.
  const avail = availability({
    slotDurationMinutes: 60,
    minNoticeHours: 0,
    maxHorizonDays: 2,
    weekly: { sun: [{ start: '01:00', end: '04:00' }] },
  });
  const slots = computeSlots({ availability: avail, now: new Date('2026-10-24T12:00:00Z') });
  assert.equal(slots.length, 4);
  assert.equal(slots[0], '2026-10-24T23:00:00Z'); // 01:00 CEST
  assert.equal(slots.at(-1), '2026-10-25T02:00:00Z'); // 03:00 CET
});

test('parseAvailability output feeds computeSlots directly', () => {
  const yamlText = `
timezone: Europe/Berlin
slot_duration_minutes: 30
buffer_before_minutes: 0
buffer_after_minutes: 15
min_notice_hours: 24
max_horizon_days: 30
meeting:
  title: "Intro call"
weekly:
  thu: [{ start: "10:00", end: "12:00" }]
blocked_dates: [2026-07-09]
`;
  const avail = parseAvailability(yamlText);
  const slots = computeSlots({ availability: avail, now: NOW });
  assert.ok(slots.length > 0);
  assert.ok(slots.every((s) => !s.startsWith('2026-07-09T')));
});

test('parseAvailability rejects overlapping windows', () => {
  const yamlText = `
timezone: Europe/Berlin
slot_duration_minutes: 30
max_horizon_days: 30
meeting: { title: "Call" }
weekly:
  mon: [{ start: "10:00", end: "12:00" }, { start: "11:30", end: "14:00" }]
`;
  assert.throws(() => parseAvailability(yamlText), /overlap/);
});
