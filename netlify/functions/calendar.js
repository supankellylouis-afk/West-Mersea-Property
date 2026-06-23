/* GET /calendar.ics
   Public iCal feed of confirmed bookings, for pasting into Airbnb /
   Booking.com / other channel managers as an iCal sync URL so they
   block these dates automatically and avoid double bookings.

   Deliberately read-only and unauthenticated (iCal sync URLs are
   fetched by third-party services with no way to send credentials),
   so SUMMARY is the generic "Booked" rather than the guest's name —
   never leak guest PII into a feed pasted into another platform. */

const { supabaseAdmin } = require('../../lib/supabase');

function toICalDate(ymd) {
  return ymd.replace(/-/g, '');
}

function foldLine(line) {
  // RFC 5545 §3.1: fold lines longer than 75 octets with CRLF + a space.
  const chunks = [];
  let rest = line;
  while (rest.length > 75) {
    chunks.push(rest.slice(0, 75));
    rest = ' ' + rest.slice(75);
  }
  chunks.push(rest);
  return chunks.join('\r\n');
}

function escapeText(text) {
  return String(text).replace(/([,;\\])/g, '\\$1');
}

exports.handler = async () => {
  try {
    const { data: bookings, error } = await supabaseAdmin
      .from('bookings')
      .select('id, check_in, check_out, updated_at, created_at')
      .eq('status', 'confirmed');
    if (error) throw error;

    const now = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Mersea Island Retreat//Booking Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Mersea Island Retreat — Bookings',
    ];

    for (const booking of bookings) {
      const stamp = booking.updated_at || booking.created_at;
      lines.push(
        'BEGIN:VEVENT',
        `UID:${booking.id}@merseaislandretreat.co.uk`,
        `DTSTAMP:${stamp ? new Date(stamp).toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z' : now}`,
        `DTSTART;VALUE=DATE:${toICalDate(booking.check_in)}`,
        `DTEND;VALUE=DATE:${toICalDate(booking.check_out)}`,
        `SUMMARY:${escapeText('Booked')}`,
        'END:VEVENT'
      );
    }

    lines.push('END:VCALENDAR');

    const body = lines.map(foldLine).join('\r\n') + '\r\n';

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="calendar.ics"',
      },
      body,
    };
  } catch (err) {
    return { statusCode: 500, body: `Failed to generate calendar feed: ${err.message}` };
  }
};
