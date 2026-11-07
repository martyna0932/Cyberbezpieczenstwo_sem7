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

function listEvents({ type = '', limit = 200 } = {}) {
  if (type) {
    return db.prepare('SELECT * FROM event_log WHERE event_type = ? ORDER BY id DESC LIMIT ?').all(type, limit);
  }
  return db.prepare('SELECT * FROM event_log ORDER BY id DESC LIMIT ?').all(limit);
}

function listEventTypes() {
  return db.prepare('SELECT DISTINCT event_type FROM event_log ORDER BY event_type').all().map((r) => r.event_type);
}

module.exports = { logEvent, listEvents, listEventTypes };
