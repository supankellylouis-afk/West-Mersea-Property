/* POST /api/create-checkout-session
   Body: { checkIn, checkOut, guests, guestName, guestEmail, guestPhone }

   Validates the requested dates against existing bookings and
   blocked dates, computes the total price from pricing_rules,
   creates a 'pending' booking row, and starts a Stripe Checkout
   Session for the 30% deposit. The booking is only marked
   'confirmed' once Stripe confirms payment (see stripe-webhook.js). */

const Stripe = require('stripe');
const { supabaseAdmin } = require('../../lib/supabase');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const DEPOSIT_RATE = 0.3;

function nightsBetween(checkIn, checkOut) {
  return Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000);
}

async function priceStay(checkIn, checkOut) {
  const { data: rules, error } = await supabaseAdmin
    .from('pricing_rules')
    .select('start_date, end_date, price_per_night, min_stay_nights')
    .lte('start_date', checkOut)
    .gte('end_date', checkIn);
  if (error) throw error;

  let total = 0;
  let minStay = 1;
  let d = new Date(checkIn);
  const end = new Date(checkOut);
  while (d < end) {
    const ymd = d.toISOString().slice(0, 10);
    const rule = rules.find(r => r.start_date <= ymd && r.end_date >= ymd);
    if (!rule) throw new Error(`No pricing rule covers ${ymd}`);
    total += Number(rule.price_per_night);
    minStay = Math.max(minStay, rule.min_stay_nights);
    d.setDate(d.getDate() + 1);
  }
  return { total, minStay };
}

async function hasConflict(checkIn, checkOut) {
  const [bookings, blocked] = await Promise.all([
    supabaseAdmin
      .from('bookings')
      .select('check_in, check_out')
      .in('status', ['pending', 'confirmed'])
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
  return bookings.data.length > 0 || blocked.data.length > 0;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { checkIn, checkOut, guests, guestName, guestEmail, guestPhone } = JSON.parse(event.body || '{}');

    if (!checkIn || !checkOut || !guests || !guestName || !guestEmail) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required booking fields' }) };
    }

    const nights = nightsBetween(checkIn, checkOut);
    if (nights < 1) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Check-out must be after check-in' }) };
    }

    if (await hasConflict(checkIn, checkOut)) {
      return { statusCode: 409, body: JSON.stringify({ error: 'Selected dates are no longer available' }) };
    }

    const { total, minStay } = await priceStay(checkIn, checkOut);
    if (nights < minStay) {
      return { statusCode: 400, body: JSON.stringify({ error: `Minimum stay is ${minStay} nights for these dates` }) };
    }

    const deposit = Math.round(total * DEPOSIT_RATE * 100) / 100;

    const { data: booking, error: insertError } = await supabaseAdmin
      .from('bookings')
      .insert({
        check_in: checkIn,
        check_out: checkOut,
        guests,
        guest_name: guestName,
        guest_email: guestEmail,
        guest_phone: guestPhone || null,
        total_price: total,
        deposit_paid: 0,
        status: 'pending',
      })
      .select()
      .single();
    if (insertError) throw insertError;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: guestEmail,
      line_items: [{
        price_data: {
          currency: 'gbp',
          unit_amount: Math.round(deposit * 100),
          product_data: {
            name: `Mersea Island Retreat — Deposit (${checkIn} to ${checkOut})`,
          },
        },
        quantity: 1,
      }],
      metadata: { booking_id: booking.id },
      success_url: `${process.env.SITE_URL}/?booking=success`,
      cancel_url: `${process.env.SITE_URL}/?booking=cancelled`,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkoutUrl: session.url, bookingId: booking.id }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
