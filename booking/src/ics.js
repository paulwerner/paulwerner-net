// Hand-rolled iCalendar builder. The `ics` npm package handles METHOD,
// SEQUENCE and per-attendee PARTSTAT poorly — exactly the fields Proton
// Mail's auto-add relies on — so the ~60 lines live here instead.

function escapeText(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

// Param values (e.g. CN) are quoted; DQUOTE itself is not representable.
function paramValue(value) {
  return `"${String(value).replace(/["\r\n]/g, '')}"`;
}

function utcStamp(date) {
  return new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

// RFC 5545 §3.1: lines fold at 75 octets with CRLF + single space.
function fold(line) {
  const out = [];
  let current = '';
  let bytes = 0;
  for (const char of line) {
    const charBytes = Buffer.byteLength(char, 'utf8');
    if (bytes + charBytes > (out.length === 0 ? 75 : 74)) {
      out.push(current);
      current = char;
      bytes = charBytes;
    } else {
      current += char;
      bytes += charBytes;
    }
  }
  out.push(current);
  return out.map((part, i) => (i === 0 ? part : ` ${part}`)).join('\r\n');
}

function attendeeLine({ name, email, partstat, rsvp }) {
  const params = [`CN=${paramValue(name)}`, 'ROLE=REQ-PARTICIPANT', `PARTSTAT=${partstat}`];
  if (rsvp) params.push('RSVP=TRUE');
  return `ATTENDEE;${params.join(';')}:mailto:${email}`;
}

export function buildIcs({
  method, // 'REQUEST' | 'CANCEL'
  uid,
  sequence,
  start,
  end,
  dtstamp = new Date(),
  summary,
  description = '',
  location = '',
  organizer, // { name, email }
  attendees, // [{ name, email, partstat, rsvp? }]
}) {
  const lines = [
    'BEGIN:VCALENDAR',
    'PRODID:-//paulwerner.net//booking//EN',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    `METHOD:${method}`,
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `SEQUENCE:${sequence}`,
    `DTSTAMP:${utcStamp(dtstamp)}`,
    `DTSTART:${utcStamp(start)}`,
    `DTEND:${utcStamp(end)}`,
    `SUMMARY:${escapeText(summary)}`,
  ];
  if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
  if (location) lines.push(`LOCATION:${escapeText(location)}`);
  lines.push(
    `ORGANIZER;CN=${paramValue(organizer.name)}:mailto:${organizer.email}`,
    ...attendees.map(attendeeLine),
    `STATUS:${method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'}`,
    'END:VEVENT',
    'END:VCALENDAR',
  );
  return lines.map(fold).join('\r\n') + '\r\n';
}
