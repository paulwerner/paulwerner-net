import { mkdirSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';

export class SlotTakenError extends Error {}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS bookings (
  id                INTEGER PRIMARY KEY,
  uid               TEXT NOT NULL UNIQUE,
  slot_start        TEXT NOT NULL,
  slot_end          TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','cancelled')),
  name              TEXT NOT NULL,
  email             TEXT NOT NULL,
  note              TEXT,
  timezone          TEXT,
  manage_token_hash TEXT NOT NULL,
  ics_sequence      INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL,
  cancelled_at      TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_slot
  ON bookings (slot_start) WHERE status = 'confirmed';
`;

// Stored instants are second-precision ("…T12:00:00Z"); inputs must match or
// the lexicographic SQL comparisons break at sub-second boundaries.
function secondPrecision(iso) {
  return iso.replace(/\.\d+Z$/, 'Z');
}

export function openDb(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA);

  const insertStmt = db.prepare(`
    INSERT INTO bookings (uid, slot_start, slot_end, name, email, note, timezone, manage_token_hash, created_at)
    VALUES (@uid, @slotStart, @slotEnd, @name, @email, @note, @timezone, @manageTokenHash, @createdAt)
  `);
  const byUidStmt = db.prepare('SELECT * FROM bookings WHERE uid = ?');
  const cancelStmt = db.prepare(`
    UPDATE bookings
    SET status = 'cancelled', cancelled_at = ?, ics_sequence = ics_sequence + 1
    WHERE uid = ? AND status = 'confirmed'
    RETURNING *
  `);
  const confirmedStmt = db.prepare(
    "SELECT slot_start, slot_end FROM bookings WHERE status = 'confirmed' AND slot_end > ?",
  );
  const cleanupStmt = db.prepare('DELETE FROM bookings WHERE slot_end < ?');

  return {
    // The partial unique index uq_active_slot is the race arbiter: two
    // concurrent inserts for the same start instant cannot both succeed.
    createBooking(booking) {
      try {
        insertStmt.run(booking);
      } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' && String(err.message).includes('slot_start')) {
          throw new SlotTakenError();
        }
        throw err;
      }
      return byUidStmt.get(booking.uid);
    },

    getBookingByUid(uid) {
      return byUidStmt.get(uid) ?? null;
    },

    // Returns the updated row, or null when unknown or already cancelled.
    cancelBooking(uid, cancelledAt) {
      return cancelStmt.get(cancelledAt, uid) ?? null;
    },

    confirmedIntervals(fromIso) {
      return confirmedStmt.all(secondPrecision(fromIso)).map((row) => ({ start: row.slot_start, end: row.slot_end }));
    },

    ping() {
      db.prepare('SELECT 1').get();
    },

    // GDPR retention: hard-delete everything whose appointment ended before
    // the cutoff, then write a crash-consistent copy for host-level backup.
    runMaintenance({ retentionDays, backupPath, now = new Date() }) {
      const cutoff = secondPrecision(new Date(now.getTime() - retentionDays * 24 * 3600 * 1000).toISOString());
      const { changes } = cleanupStmt.run(cutoff);
      if (backupPath) {
        mkdirSync(dirname(backupPath), { recursive: true });
        rmSync(backupPath, { force: true });
        db.prepare('VACUUM INTO ?').run(backupPath);
      }
      return { deleted: changes };
    },

    close() {
      db.close();
    },
  };
}
