const db = require('../db');

function getSetting(key, defaultValue = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : defaultValue;
}

function getNumber(key, defaultValue = 0) {
  const value = Number(getSetting(key));
  return getSetting(key) === null || Number.isNaN(value) ? defaultValue : value;
}

function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM settings ORDER BY key').all();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

function setSetting(key, value) {
  const result = db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(String(value), key);
  return result.changes > 0;
}

module.exports = { getSetting, getNumber, getAllSettings, setSetting };
