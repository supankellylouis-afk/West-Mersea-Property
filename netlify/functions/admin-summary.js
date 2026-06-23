/* GET /api/admin-summary
   Auth: Bearer <admin session token>
   Returns:
   {
     nextBooking: { check_in, check_out, guest_name } | null,
     occupancyPct: number,   // % of this month's nights covered by confirmed bookings
     revenueThisMonth: number // total_price of confirmed bookings arriving this month
   } */

const { verifyToken } = require('../../lib/admin-auth');
const { supabaseAdmin } = require('../../lib/supabase');

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method not allowed' };
  }
  if (!verifyToken(event.headers.authorization)) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);
    const totalDaysThisMonth = daysInMonth(now.getFullYear(), now.getMonth());

    const [nextBookingRes, monthBookingsRes] = await Promise.all([
      supabaseAdmin
        .from('bookings')
        .select('check_in, check_out, guest_name')
        .eq('status', 'confirmed')
        .gte('check_in', todayStr)
        .order('check_in', { ascending: true })
        .limit(1),
      // Any confirmed booking that overlaps this calendar month at all,
      // so both occupancy (nights within the month) and revenue
      // (bookings arriving this month) can be derived from one query.
      supabaseAdmin
        .from('bookings')
        .select('check_in, check_out, total_price')
        .eq('status', 'confirmed')
        .lt('check_in', monthEnd)
        .gt('check_out', monthStart),
    ]);
    if (nextBookingRes.error) throw nextBookingRes.error;
    if (monthBookingsRes.error) throw monthBookingsRes.error;

    let nightsOccupied = 0;
    let revenueThisMonth = 0;
    for (const booking of monthBookingsRes.data) {
      const overlapStart = booking.check_in > monthStart ? booking.check_in : monthStart;
      const overlapEnd = booking.check_out < monthEnd ? booking.check_out : monthEnd;
      const nights = Math.round((new Date(overlapEnd) - new Date(overlapStart)) / 86400000);
      nightsOccupied += Math.max(0, nights);

      if (booking.check_in >= monthStart && booking.check_in < monthEnd) {
        revenueThisMonth += Number(booking.total_price);
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nextBooking: nextBookingRes.data[0] || null,
        occupancyPct: Math.round((nightsOccupied / totalDaysThisMonth) * 1000) / 10,
        revenueThisMonth,
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
