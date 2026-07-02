import nodemailer from 'nodemailer';
import { DateTime } from 'luxon';
import { buildIcs } from './ics.js';

function ownerLocal(iso, zone) {
  return DateTime.fromISO(iso, { zone }).toFormat("cccc, d LLLL yyyy 'at' HH:mm ZZZZ");
}

export function createMailer({ config, transport }) {
  const mail =
    transport ??
    nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      requireTLS: config.smtp.port === 587,
      // Dev SMTP sinks (mailpit) advertise no AUTH; only authenticate when
      // credentials are actually configured.
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.password } : undefined,
    });

  const zone = config.availability.timezone;
  const { title, locationNote } = config.availability.meeting;

  function icsFor(booking, method) {
    return buildIcs({
      method,
      uid: booking.uid,
      sequence: booking.ics_sequence,
      start: booking.slot_start,
      end: booking.slot_end,
      summary: `${title} — ${booking.name}`,
      description: [`Booked via ${config.publicUrl}/book/`, booking.note ? `Note: ${booking.note}` : '']
        .filter(Boolean)
        .join('\n'),
      location: locationNote,
      // The From address organizes; the owner's Proton address must be an
      // ATTENDEE (not the organizer) or Proton treats the invite as
      // self-organized and skips auto-add.
      organizer: { name: 'paulwerner.net bookings', email: config.fromAddress },
      attendees: [
        { name: 'Paul Werner', email: config.ownerEmail, partstat: 'NEEDS-ACTION', rsvp: true },
        { name: booking.name, email: booking.email, partstat: 'ACCEPTED' },
      ],
    });
  }

  async function send({ to, subject, text, ics, method }) {
    return mail.sendMail({
      from: { name: 'paulwerner.net bookings', address: config.fromAddress },
      to,
      subject,
      text,
      icalEvent: { method, content: ics },
    });
  }

  return {
    async sendBookingEmails({ booking, manageUrl }) {
      const when = ownerLocal(booking.slot_start, zone);
      const ics = icsFor(booking, 'REQUEST');

      await send({
        to: config.ownerEmail,
        subject: `New booking: ${booking.name} — ${when}`,
        text: [
          `${booking.name} <${booking.email}> booked "${title}".`,
          '',
          `When: ${when}`,
          booking.note ? `Note: ${booking.note}` : null,
          '',
          'The attached invite is added to Proton Calendar automatically.',
        ]
          .filter((line) => line !== null)
          .join('\n'),
        ics,
        method: 'REQUEST',
      });

      await send({
        to: booking.email,
        subject: `Confirmed: ${title} on ${when}`,
        text: [
          `Hi ${booking.name},`,
          '',
          `your appointment is confirmed: ${when}.`,
          locationNote,
          '',
          'The attached invite adds the appointment to your calendar.',
          `Need to cancel or reschedule? ${manageUrl}`,
          '',
          'Talk soon.',
        ].join('\n'),
        ics,
        method: 'REQUEST',
      });
    },

    async sendCancellationEmails({ booking }) {
      const when = ownerLocal(booking.slot_start, zone);
      const ics = icsFor(booking, 'CANCEL');

      await send({
        to: config.ownerEmail,
        subject: `Cancelled: ${booking.name} — ${when}`,
        text: `${booking.name} <${booking.email}> cancelled the ${title} on ${when}.`,
        ics,
        method: 'CANCEL',
      });

      await send({
        to: booking.email,
        subject: `Cancelled: ${title} on ${when}`,
        text: [
          `Hi ${booking.name},`,
          '',
          `your appointment on ${when} is cancelled.`,
          `You can pick a new time any time: ${config.publicUrl}/book/`,
        ].join('\n'),
        ics,
        method: 'CANCEL',
      });
    },
  };
}
