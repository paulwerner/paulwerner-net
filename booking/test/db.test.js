import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb, SlotTakenError } from '../src/db.js';

function booking(overrides = {}) {
  return {
    uid: `booking-${Math.random().toString(36).slice(2)}@paulwerner.net`,
    slotStart: '2026-07-02T12:00:00Z',
    slotEnd: '2026-07-02T12:30:00Z',
    name: 'Test Prospect',
    email: 'prospect@example.com',
    note: null,
    timezone: null,
    manageTokenHash: 'hash',
    createdAt: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

test('create and read back a booking', () => {
  const db = openDb(':memory:');
  const created = db.createBooking(booking({ uid: 'booking-a@paulwerner.net' }));
  assert.equal(created.status, 'confirmed');
  assert.equal(created.ics_sequence, 0);
  assert.equal(db.getBookingByUid('booking-a@paulwerner.net').email, 'prospect@example.com');
  assert.equal(db.getBookingByUid('nope'), null);
});

test('second confirmed booking for the same start throws SlotTakenError', () => {
  const db = openDb(':memory:');
  db.createBooking(booking());
  assert.throws(() => db.createBooking(booking()), SlotTakenError);
});

test('a cancelled slot can be rebooked', () => {
  const db = openDb(':memory:');
  const first = db.createBooking(booking());
  db.cancelBooking(first.uid, '2026-07-01T10:00:00Z');
  assert.doesNotThrow(() => db.createBooking(booking()));
});

test('cancel bumps the ICS sequence and is idempotent-safe', () => {
  const db = openDb(':memory:');
  const created = db.createBooking(booking());
  const cancelled = db.cancelBooking(created.uid, '2026-07-01T10:00:00Z');
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.ics_sequence, 1);
  assert.equal(db.cancelBooking(created.uid, '2026-07-01T11:00:00Z'), null);
});

test('confirmedIntervals excludes cancelled and past bookings', () => {
  const db = openDb(':memory:');
  db.createBooking(booking({ slotStart: '2026-07-02T12:00:00Z', slotEnd: '2026-07-02T12:30:00Z' }));
  const toCancel = db.createBooking(booking({ slotStart: '2026-07-03T12:00:00Z', slotEnd: '2026-07-03T12:30:00Z' }));
  db.cancelBooking(toCancel.uid, '2026-07-01T10:00:00Z');
  db.createBooking(booking({ slotStart: '2026-06-01T12:00:00Z', slotEnd: '2026-06-01T12:30:00Z' }));

  const intervals = db.confirmedIntervals('2026-07-01T00:00:00Z');
  assert.deepEqual(intervals, [{ start: '2026-07-02T12:00:00Z', end: '2026-07-02T12:30:00Z' }]);
});

test('maintenance deletes expired rows and writes a backup copy', () => {
  const dir = mkdtempSync(join(tmpdir(), 'booking-db-'));
  const db = openDb(join(dir, 'bookings.db'));
  db.createBooking(booking({ slotStart: '2026-01-05T12:00:00Z', slotEnd: '2026-01-05T12:30:00Z' }));
  db.createBooking(booking({ slotStart: '2026-07-02T12:00:00Z', slotEnd: '2026-07-02T12:30:00Z' }));

  const backupPath = join(dir, 'backup', 'bookings.db');
  const result = db.runMaintenance({ retentionDays: 90, backupPath, now: new Date('2026-07-01T00:00:00Z') });
  assert.equal(result.deleted, 1);
  assert.ok(existsSync(backupPath));
  // Backup runs after cleanup and must reopen cleanly with the survivor.
  const restored = openDb(backupPath);
  assert.equal(restored.confirmedIntervals('2026-01-01T00:00:00Z').length, 1);
});
