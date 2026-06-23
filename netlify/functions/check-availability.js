/* POST /api/check-availability
   Body: { checkIn, checkOut }  (ISO date strings, checkOut exclusive)

   Returns:
   {
     available: boolean,
     reason?: string,            // present when available === false
     price: number | null,       // total stay price, null if unavailable or rules missing
     nights: number,
     breakdown: [{ date, rate, tier }]   // tier: 'peak' | 'off-peak'
   }

   Read-only check — does not create or modify any booking. */

const { supabaseAdmin } = require('../../lib/supabase');

function isoDaysBetween(checkIn, checkOut) {
  const days = [];
  const d = new Date(checkIn);
  const end = new Date(checkOut);
  while (d < end) {
    days.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

async function findConflicts(checkIn, checkOut) {
  const [bookings, blocked] = await Promise.all([
    supabaseAdmin
      .from('bookings')
      .select('check_in, check_out')
      .eq('status', 'confirmed')
      .lt('check_in', checkOut)
      .gt('check_out', checkIn),
    supabaseAdmin
      .from('blocked_dates')
      .select('date')
      .gte('date', checkIn)
      .lt('date', checkOut),
  ]);
  if (bookings.error) throw bookings.error;
  if (blocked.error) throw blocked.error;
  return { bookingConflict: bookings.data.length > 0, blockedConflict: blocked.data.length > 0 };
}

async function priceBreakdown(days) {
  const { data: rules, error } = await supabaseAdmin
    .from('pricing_rules')
    .select('start_date, end_date, price_per_night, min_stay_nights');
  if (error) throw error;

  const breakdown = [];
  let total = 0;
  let minStay = 1;

  for (const date of days) {
    const rule = rules.find(r => r.start_date <= date && r.end_date >= date);
    if (!rule) {
      return { breakdown: null, total: null, minStay: null, missingDate: date };
    }
    const rate = Number(rule.price_per_night);
    const tier = rate >= 350 ? 'peak' : 'off-peak'; // matches the site's high-season threshold
    breakdown.push({ date, rate, tier });
    total += rate;
    minStay = Math.max(minStay, rule.min_stay_nights);
  }

  return { breakdown, total, minStay, missingDate: null };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { checkIn, checkOut } = JSON.parse(event.body || '{}');

    if (!checkIn || !checkOut) {
      return { statusCode: 400, body: JSON.stringify({ error: 'checkIn and checkOut are required' }) };
    }

    const days = isoDaysBetween(checkIn, checkOut);
    if (days.length < 1) {
      return { statusCode: 400, body: JSON.stringify({ error: 'checkOut must be after checkIn' }) };
    }

    const { bookingConflict, blockedConflict } = await findConflicts(checkIn, checkOut);
    if (bookingConflict || blockedConflict) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          available: false,
          reason: bookingConflict ? 'Dates overlap an existing booking' : 'Dates include an owner-blocked date',
          price: null,
          nights: days.length,
          breakdown: [],
        }),
      };
    }

    const { breakdown, total, minStay, missingDate } = await priceBreakdown(days);
    if (missingDate) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          available: false,
          reason: `No pricing rule is set up for ${missingDate}`,
          price: null,
          nights: days.length,
          breakdown: [],
        }),
      };
    }

    if (days.length < minStay) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          available: false,
          reason: `Minimum stay for these dates is ${minStay} nights`,
          price: null,
          nights: days.length,
          breakdown,
        }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        available: true,
        price: total,
        nights: days.length,
        breakdown,
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
