/* GET  /api/admin-pricing
   Auth: Bearer <admin session token>
   Returns all pricing_rules rows, ordered by start_date.

   POST /api/admin-pricing
   Auth: Bearer <admin session token>
   Body: { startDate, endDate, pricePerNight, minStayNights }
   Inserts a new pricing rule covering that date range. */

const { verifyToken } = require('../../lib/admin-auth');
const { supabaseAdmin } = require('../../lib/supabase');

exports.handler = async (event) => {
  if (!verifyToken(event.headers.authorization)) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    if (event.httpMethod === 'GET') {
      const { data: rules, error } = await supabaseAdmin
        .from('pricing_rules')
        .select('id, start_date, end_date, price_per_night, min_stay_nights')
        .order('start_date', { ascending: true });
      if (error) throw error;

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules }),
      };
    }

    if (event.httpMethod === 'POST') {
      const { startDate, endDate, pricePerNight, minStayNights } = JSON.parse(event.body || '{}');
      if (!startDate || !endDate || !pricePerNight) {
        return { statusCode: 400, body: JSON.stringify({ error: 'startDate, endDate and pricePerNight are required' }) };
      }
      if (endDate < startDate) {
        return { statusCode: 400, body: JSON.stringify({ error: 'endDate must not be before startDate' }) };
      }

      const { data: rule, error } = await supabaseAdmin
        .from('pricing_rules')
        .insert({
          start_date: startDate,
          end_date: endDate,
          price_per_night: pricePerNight,
          min_stay_nights: minStayNights || 1,
        })
        .select()
        .single();
      if (error) throw error;

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule }),
      };
    }

    return { statusCode: 405, body: 'Method not allowed' };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
