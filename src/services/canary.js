const config = require('../config');
const { logEvent } = require('./eventLog');

function triggerHoneypotAlert({ login, ip, userAgent }) {
  const url = config.canary.honeypotUrl;
  logEvent({ login, type: 'honeytoken.triggered', details: url ? 'alert wysłany' : 'brak CANARY_HONEYPOT_URL', ip });
  if (!url) return;
  const target = new URL(url);
  target.searchParams.set('login', login);
  target.searchParams.set('ip', ip || '');
  fetch(target, {
    headers: { 'User-Agent': String(userAgent || 'auth-app').slice(0, 300) },
    signal: AbortSignal.timeout(5000),
  }).catch(() => {});
}

module.exports = { triggerHoneypotAlert };
