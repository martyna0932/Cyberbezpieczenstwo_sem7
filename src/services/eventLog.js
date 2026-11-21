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

function listEvents({ type = '', limit = 200 } = {}) {
  const entries = readEntries().reverse();
  return (type ? entries.filter((e) => e.action === type) : entries).slice(0, limit);
}

function listEventTypes() {
  return [...new Set(readEntries().map((e) => e.action))].sort();
}

module.exports = { logEvent, listEvents, listEventTypes };
