const config = require('../config');

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

async function verifyTurnstile(token) {
  if (typeof token !== 'string' || token === '' || token.length > 2048) {
    return { success: false, errors: ['missing-input-response'] };
  }

  try {
    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      body: new URLSearchParams({ secret: config.turnstile.secretKey, response: token }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await response.json();
    return { success: data.success === true, errors: data['error-codes'] || [] };
  } catch {
    return { success: false, errors: ['verification-unavailable'] };
  }
}

module.exports = { verifyTurnstile };
