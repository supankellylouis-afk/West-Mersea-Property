/* ============================================================
   Supabase client — server-side only (Netlify functions)
   ------------------------------------------------------------
   Uses the SERVICE ROLE key, which bypasses Row Level Security.
   Never import this file from frontend code or expose
   SUPABASE_SERVICE_ROLE_KEY to the browser — it grants full
   read/write access to every table, including guest PII in
   `bookings`.
   ============================================================ */

const { createClient } = require('@supabase/supabase-js');

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable');
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

module.exports = { supabaseAdmin };
