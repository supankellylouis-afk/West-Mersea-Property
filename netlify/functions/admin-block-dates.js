/* POST /api/admin-block-dates
   Auth: Bearer <admin session token>
   Body: { startDate, endDate, reason }   (endDate exclusive)
   Inserts one blocked_dates row per night in the range. */

const { verifyToken } = require('../../lib/admin-auth');
const { supabaseAdmin } = require('../../lib/supabase');

function isoDaysBetween(startDate, endDate) {
  const days = [];
  const d = new Date(startDate);
  const end = new Date(endDate);
  while (d < end) {
    days.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }
  if (!verifyToken(event.headers.authorization)) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const { startDate, endDate, reason } = JSON.parse(event.body || '{}');
    if (!startDate || !endDate) {
      return { statusCode: 400, body: JSON.stringify({ error: 'startDate and endDate are required' }) };
    }

    const days = isoDaysBetween(startDate, endDate);
    if (days.length < 1) {
      return { statusCode: 400, body: JSON.stringify({ error: 'endDate must be after startDate' }) };
    }

    const rows = days.map(date => ({ date, reason: reason || 'Blocked by owner' }));
    const { error } = await supabaseAdmin.from('blocked_dates').insert(rows);
    if (error) throw error;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocked: days }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
