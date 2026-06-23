/* POST /api/stripe-webhook
   Verifies the Stripe signature, and on successful payment marks
   the matching booking 'confirmed' and emails the guest via Resend. */

const Stripe = require('stripe');
const { Resend } = require('resend');
const { supabaseAdmin } = require('../../lib/supabase');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

exports.handler = async (event) => {
  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      event.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return { statusCode: 400, body: `Webhook signature verification failed: ${err.message}` };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const bookingId = session.metadata && session.metadata.booking_id;
    const depositPaid = (session.amount_total || 0) / 100;

    if (bookingId) {
      const { data: booking, error } = await supabaseAdmin
        .from('bookings')
        .update({ status: 'confirmed', deposit_paid: depositPaid })
        .eq('id', bookingId)
        .select()
        .single();

      if (!error && booking) {
        await resend.emails.send({
          from: 'Mersea Island Retreat <bookings@merseaislandretreat.co.uk>',
          to: booking.guest_email,
          subject: 'Booking confirmed — Mersea Island Retreat',
          html: `
            <p>Hi ${booking.guest_name},</p>
            <p>Your booking is confirmed:</p>
            <ul>
              <li><strong>Check-in:</strong> ${booking.check_in}</li>
              <li><strong>Check-out:</strong> ${booking.check_out}</li>
              <li><strong>Total stay price:</strong> £${booking.total_price}</li>
              <li><strong>Deposit paid:</strong> £${booking.deposit_paid}</li>
              <li><strong>Balance due:</strong> £${(booking.total_price - booking.deposit_paid).toFixed(2)} (8 weeks before arrival)</li>
            </ul>
            <p>We look forward to welcoming you to Mersea Island Retreat.</p>
          `,
        });
      }
    }
  }

  return { statusCode: 200, body: 'ok' };
};
