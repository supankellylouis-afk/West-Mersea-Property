/* GET /api/get-booking?session_id=...
   Looks up the Stripe Checkout Session to find the associated
   booking_id, then returns a guest-safe summary of that booking
   for display on booking-confirmed.html. Read-only. */

const Stripe = require('stripe');
const { supabaseAdmin } = require('../../lib/supabase');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const sessionId = event.queryStringParameters && event.queryStringParameters.session_id;
  if (!sessionId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'session_id is required' }) };
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const bookingId = session.metadata && session.metadata.booking_id;
    if (!bookingId) {
      return { statusCode: 404, body: JSON.stringify({ error: 'No booking found for this session' }) };
    }

    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .select('check_in, check_out, guests, guest_name, total_price, deposit_paid, status')
      .eq('id', bookingId)
      .single();
    if (error || !booking) {
      return { statusCode: 404, body: JSON.stringify({ error: 'No booking found for this session' }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
