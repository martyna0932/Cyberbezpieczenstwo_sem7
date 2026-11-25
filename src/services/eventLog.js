const { append, readEntries } = require('./securityLog');
const { describeDetails } = require('./eventLabels');

const FAILURE_TYPES = new Set([
  'login.failure',
  'account.locked',
  'captcha.failure',
  'bot.honeypot',
  'honeytoken.triggered',
  'ip.blocked',
  'access.denied',
  'password.change_failed',
  'totp.enable_failed',
  'totp.disable_failed',
]);

function logEvent({ login = null, type, details = null, ip = null, result = null }) {
  try {
    append({
      user: login,
      ip,
      action: type,
      result: result || (FAILURE_TYPES.has(type) ? 'BŁĄD' : 'SUKCES'),
      desc: describeDetails(type, details),
    });
  } catch (err) {
    console.error('Błąd zapisu do dziennika zdarzeń:', err.message);
  }
}

function dayStart(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00`).getTime() : null;
}

function filterEvents({ type = '', user = '', from = '', to = '' } = {}) {
  const fromMs = dayStart(from);
  const toMs = dayStart(to);
  return readEntries().filter((e) => {
    const time = Date.parse(e.time);
    if (type && e.action !== type) return false;
    if (user && e.user !== user) return false;
    if (fromMs !== null && time < fromMs) return false;
    if (toMs !== null && time >= toMs + 24 * 60 * 60 * 1000) return false;
    return true;
  });
}

function listEventTypes() {
  return [...new Set(readEntries().map((e) => e.action))].sort();
}

function listEventUsers() {
  return [...new Set(readEntries().map((e) => e.user))].sort();
}

module.exports = { logEvent, filterEvents, listEventTypes, listEventUsers };
