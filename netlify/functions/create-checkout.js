/* POST /api/create-checkout
   Body: { checkIn, checkOut, guests, guestName, guestEmail, guestPhone, totalPrice }

   Re-checks the requested dates for conflicts, stores a 'pending'
   booking using the supplied total price, and starts a Stripe
   Checkout Session for the flat £200 deposit. The booking is only
   marked 'confirmed' once Stripe confirms payment (see
   stripe-webhook.js). */

const Stripe = require('stripe');
const { supabaseAdmin } = require('../../lib/supabase');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const DEPOSIT_AMOUNT = 200; // flat deposit, GBP

function nightsBetween(checkIn, checkOut) {
  return Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000);
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
    const { checkIn, checkOut, guests, guestName, guestEmail, guestPhone, totalPrice } = JSON.parse(event.body || '{}');

    if (!checkIn || !checkOut || !guests || !guestName || !guestEmail || !totalPrice) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required booking fields' }) };
    }

    const nights = nightsBetween(checkIn, checkOut);
    if (nights < 1) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Check-out must be after check-in' }) };
    }

    if (await hasConflict(checkIn, checkOut)) {
      return { statusCode: 409, body: JSON.stringify({ error: 'Selected dates are no longer available' }) };
    }

    const { data: booking, error: insertError } = await supabaseAdmin
      .from('bookings')
      .insert({
        check_in: checkIn,
        check_out: checkOut,
        guests,
        guest_name: guestName,
        guest_email: guestEmail,
        guest_phone: guestPhone || null,
        total_price: totalPrice,
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
          unit_amount: Math.round(DEPOSIT_AMOUNT * 100),
          product_data: {
            name: `Mersea Island Retreat — Deposit (${checkIn} to ${checkOut})`,
          },
        },
        quantity: 1,
      }],
      metadata: { booking_id: booking.id },
      success_url: `${process.env.SITE_URL}/booking-confirmed.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_URL}/book.html`,
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
