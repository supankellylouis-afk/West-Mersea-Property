/* GET /api/get-availability
   Returns booked date ranges, owner-blocked dates, and pricing
   rules so the frontend calendar can render real availability. */

const { supabaseAdmin } = require('../../lib/supabase');

exports.handler = async () => {
  try {
    const [bookings, blocked, pricing] = await Promise.all([
      supabaseAdmin.from('bookings').select('check_in, check_out').in('status', ['pending', 'confirmed']),
      supabaseAdmin.from('blocked_dates').select('date, reason'),
      supabaseAdmin.from('pricing_rules').select('start_date, end_date, price_per_night, min_stay_nights'),
    ]);

    if (bookings.error) throw bookings.error;
    if (blocked.error) throw blocked.error;
    if (pricing.error) throw pricing.error;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookedRanges: bookings.data,
        blockedDates: blocked.data,
        pricingRules: pricing.data,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
