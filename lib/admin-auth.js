/* ============================================================
   Admin session tokens — server-side only.
   ------------------------------------------------------------
   Stateless HMAC-signed tokens ("expiry.signature"), keyed off
   ADMIN_PASSWORD so no extra secret needs provisioning. Tokens
   are short-lived and never touch Supabase or the client's
   password — only admin-login.js sees the raw password.
   ============================================================ */

const crypto = require('crypto');

const SESSION_HOURS = 8;

function getSecret() {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) throw new Error('Missing ADMIN_PASSWORD environment variable');
  return secret;
}

function sign(expiry) {
  return crypto.createHmac('sha256', getSecret()).update(String(expiry)).digest('hex');
}

function createToken() {
  const expiry = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  return `${expiry}.${sign(expiry)}`;
}

function verifyPassword(candidate) {
  const expected = getSecret();
  const a = Buffer.from(String(candidate || ''));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function verifyToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice('Bearer '.length);
  const [expiryStr, signature] = token.split('.');
  if (!expiryStr || !signature) return false;

  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || Date.now() > expiry) return false;

  const expectedSig = sign(expiry);
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { createToken, verifyPassword, verifyToken };
