const db = require('../db');

const insert = db.prepare(
  'INSERT INTO event_log (user_id, login, event_type, details, ip) VALUES (?, ?, ?, ?, ?)'
);

function logEvent({ userId = null, login = null, type, details = null, ip = null }) {
  try {
    insert.run(userId, login, type, details, ip);
  } catch (err) {
    console.error('Błąd zapisu do event_log:', err.message);
  }
}

module.exports = { logEvent };
