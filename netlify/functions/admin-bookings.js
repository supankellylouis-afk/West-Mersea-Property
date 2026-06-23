/* GET /api/admin-bookings
   Auth: Bearer <admin session token>
   Returns upcoming bookings (check-out today or later) ordered by
   check-in, for the admin table: dates, guest name, guests, status,
   deposit paid. */

const { verifyToken } = require('../../lib/admin-auth');
const { supabaseAdmin } = require('../../lib/supabase');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method not allowed' };
  }
  if (!verifyToken(event.headers.authorization)) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const todayStr = new Date().toISOString().slice(0, 10);

    const { data: bookings, error } = await supabaseAdmin
      .from('bookings')
      .select('id, check_in, check_out, guests, guest_name, status, total_price, deposit_paid')
      .gte('check_out', todayStr)
      .order('check_in', { ascending: true });
    if (error) throw error;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookings }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
