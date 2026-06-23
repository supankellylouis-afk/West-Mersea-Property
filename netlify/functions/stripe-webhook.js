/* POST /api/stripe-webhook
   Verifies the Stripe signature, and on successful payment marks
   the matching booking 'confirmed' and emails both the guest and
   the owner via Resend. */

const Stripe = require('stripe');
const { Resend } = require('resend');
const { supabaseAdmin } = require('../../lib/supabase');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);
const OWNER_EMAIL = 'supankellylouis@gmail.com';

function formatDate(ymd) {
  return new Date(ymd).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function guestEmailHtml(booking) {
  const balanceDue = (booking.total_price - booking.deposit_paid).toFixed(2);
  return `
    <p>Hi ${booking.guest_name},</p>
    <p>Thank you for booking direct — your stay at Mersea Island Retreat is confirmed.</p>
    <ul>
      <li><strong>Check-in:</strong> ${formatDate(booking.check_in)}</li>
      <li><strong>Check-out:</strong> ${formatDate(booking.check_out)}</li>
      <li><strong>Guests:</strong> ${booking.guests}</li>
      <li><strong>Total stay price:</strong> £${booking.total_price}</li>
      <li><strong>Deposit paid today:</strong> £${booking.deposit_paid}</li>
      <li><strong>Balance due:</strong> £${balanceDue} (8 weeks before arrival)</li>
    </ul>
    <p><strong>Check-in instructions:</strong> [Check-in instructions placeholder — key safe code, parking, and arrival window will be sent here closer to your stay.]</p>
    <p>One more thing — because Mersea is a tidal island, the Strood road floods twice a day. About 3 days before you arrive, we'll send you a personal tide guide with the safe crossing times for your stay, so you can plan your journey with no surprises.</p>
    <p>We look forward to welcoming you to Mersea Island Retreat.</p>
  `;
}

function ownerEmailHtml(booking) {
  return `
    <p>New booking received.</p>
    <ul>
      <li><strong>Check-in:</strong> ${formatDate(booking.check_in)}</li>
      <li><strong>Check-out:</strong> ${formatDate(booking.check_out)}</li>
      <li><strong>Guests:</strong> ${booking.guests}</li>
      <li><strong>Total stay price:</strong> £${booking.total_price}</li>
      <li><strong>Deposit paid:</strong> £${booking.deposit_paid}</li>
      <li><strong>Balance due:</strong> £${(booking.total_price - booking.deposit_paid).toFixed(2)}</li>
    </ul>
    <p><strong>Guest contact details</strong></p>
    <ul>
      <li><strong>Name:</strong> ${booking.guest_name}</li>
      <li><strong>Email:</strong> ${booking.guest_email}</li>
      <li><strong>Phone:</strong> ${booking.guest_phone || 'Not provided'}</li>
    </ul>
  `;
}

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
        await Promise.all([
          resend.emails.send({
            from: 'Mersea Island Retreat <bookings@merseaislandretreat.co.uk>',
            to: booking.guest_email,
            subject: 'Your Mersea Island Retreat booking is confirmed',
            html: guestEmailHtml(booking),
          }),
          resend.emails.send({
            from: 'Mersea Island Retreat <bookings@merseaislandretreat.co.uk>',
            to: OWNER_EMAIL,
            subject: `New booking — ${booking.guest_name} ${booking.check_in}`,
            html: ownerEmailHtml(booking),
          }),
        ]);
      }
    }
  }

  return { statusCode: 200, body: 'ok' };
};
