/* POST /api/admin-login
   Body: { password }
   Checks the password against ADMIN_PASSWORD and, on success,
   returns a short-lived signed session token for use as
   `Authorization: Bearer <token>` on the other admin-* functions. */

const { verifyPassword, createToken } = require('../../lib/admin-auth');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { password } = JSON.parse(event.body || '{}');
    if (!verifyPassword(password)) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Incorrect password' }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: createToken() }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
