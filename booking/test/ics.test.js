import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIcs } from '../src/ics.js';
import { createMailer } from '../src/mailer.js';
import nodemailer from 'nodemailer';

function sampleIcs(overrides = {}) {
  return buildIcs({
    method: 'REQUEST',
    uid: 'booking-abc@paulwerner.net',
    sequence: 0,
    start: '2026-07-02T12:00:00Z',
    end: '2026-07-02T12:30:00Z',
    dtstamp: '2026-07-01T00:00:00Z',
    summary: 'Intro call — Jane Doe',
    description: 'Booked via https://paulwerner.net/book/',
    location: 'Video call',
    organizer: { name: 'paulwerner.net bookings', email: 'bookings@paulwerner.net' },
    attendees: [
      { name: 'Paul Werner', email: 'owner@proton.me', partstat: 'NEEDS-ACTION', rsvp: true },
      { name: 'Jane Doe', email: 'jane@example.com', partstat: 'ACCEPTED' },
    ],
    ...overrides,
  });
}

function unfold(ics) {
  return ics.replace(/\r\n[ \t]/g, '');
}

test('REQUEST invite carries the fields Proton auto-add depends on', () => {
  const ics = unfold(sampleIcs());
  assert.match(ics, /METHOD:REQUEST/);
  assert.match(ics, /UID:booking-abc@paulwerner\.net/);
  assert.match(ics, /SEQUENCE:0/);
  assert.match(ics, /DTSTART:20260702T120000Z/);
  assert.match(ics, /DTEND:20260702T123000Z/);
  assert.match(ics, /ORGANIZER;CN="paulwerner\.net bookings":mailto:bookings@paulwerner\.net/);
  assert.match(ics, /ATTENDEE;CN="Paul Werner";ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:owner@proton\.me/);
  assert.match(ics, /ATTENDEE;CN="Jane Doe";ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED:mailto:jane@example\.com/);
  assert.match(ics, /STATUS:CONFIRMED/);
});

test('CANCEL flips status and keeps the UID', () => {
  const ics = unfold(sampleIcs({ method: 'CANCEL', sequence: 1 }));
  assert.match(ics, /METHOD:CANCEL/);
  assert.match(ics, /SEQUENCE:1/);
  assert.match(ics, /STATUS:CANCELLED/);
  assert.match(ics, /UID:booking-abc@paulwerner\.net/);
});

test('text values are escaped and long lines folded per RFC 5545', () => {
  const ics = sampleIcs({
    summary: 'Call; with, tricky\nvalues',
    description: 'x'.repeat(200),
  });
  assert.match(unfold(ics), /SUMMARY:Call\\; with\\, tricky\\nvalues/);
  for (const line of ics.split('\r\n')) {
    assert.ok(Buffer.byteLength(line, 'utf8') <= 75, `line exceeds 75 octets: ${line.slice(0, 80)}`);
  }
});

test('mailer sends owner invite and prospect confirmation with ICS parts', async () => {
  const sent = [];
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
  const config = {
    publicUrl: 'https://paulwerner.net',
    ownerEmail: 'owner@proton.me',
    fromAddress: 'bookings@paulwerner.net',
    smtp: { host: 'unused', port: 587, user: '', password: '' },
    availability: { timezone: 'Europe/Berlin', meeting: { title: 'Intro call', locationNote: 'Video call' } },
  };
  const mailer = createMailer({ config, transport });
  const origSend = transport.sendMail.bind(transport);
  transport.sendMail = async (opts) => {
    const info = await origSend(opts);
    sent.push({ to: opts.to, subject: opts.subject, raw: info.message.toString() });
    return info;
  };

  await mailer.sendBookingEmails({
    booking: {
      uid: 'booking-abc@paulwerner.net',
      ics_sequence: 0,
      slot_start: '2026-07-02T12:00:00Z',
      slot_end: '2026-07-02T12:30:00Z',
      name: 'Jane Doe',
      email: 'jane@example.com',
      note: 'About the Ghost theme',
    },
    manageUrl: 'https://paulwerner.net/book/manage/?uid=booking-abc@paulwerner.net&token=t0k3n',
  });

  assert.equal(sent.length, 2);
  const [ownerMail, prospectMail] = sent;
  assert.equal(ownerMail.to, 'owner@proton.me');
  assert.match(ownerMail.raw, /method=REQUEST/);
  assert.match(ownerMail.subject, /New booking: Jane Doe/);
  // Berlin is UTC+2 in July: 12:00Z → 14:00 local.
  assert.match(ownerMail.subject, /14:00/);
  assert.equal(prospectMail.to, 'jane@example.com');
  // Bodies are quoted-printable; undo soft breaks and =3D before matching.
  const decoded = prospectMail.raw.replace(/=\r\n/g, '').replace(/=3D/g, '=');
  assert.match(decoded, /token=t0k3n/);
  assert.match(prospectMail.raw, /method=REQUEST/);
});

test('cancellation emails carry METHOD:CANCEL with bumped sequence', async () => {
  const sent = [];
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
  const origSend = transport.sendMail.bind(transport);
  transport.sendMail = async (opts) => {
    const info = await origSend(opts);
    sent.push(info.message.toString());
    return info;
  };
  const mailer = createMailer({
    config: {
      publicUrl: 'https://paulwerner.net',
      ownerEmail: 'owner@proton.me',
      fromAddress: 'bookings@paulwerner.net',
      smtp: { host: 'unused', port: 587, user: '', password: '' },
      availability: { timezone: 'Europe/Berlin', meeting: { title: 'Intro call', locationNote: '' } },
    },
    transport,
  });

  await mailer.sendCancellationEmails({
    booking: {
      uid: 'booking-abc@paulwerner.net',
      ics_sequence: 1,
      slot_start: '2026-07-02T12:00:00Z',
      slot_end: '2026-07-02T12:30:00Z',
      name: 'Jane Doe',
      email: 'jane@example.com',
    },
  });

  assert.equal(sent.length, 2);
  for (const raw of sent) {
    assert.match(raw, /method=CANCEL/);
    const decoded = raw.replace(/=\r\n/g, '').replace(/=3D/g, '=');
    assert.match(decoded, /SEQUENCE:1/);
  }
});
