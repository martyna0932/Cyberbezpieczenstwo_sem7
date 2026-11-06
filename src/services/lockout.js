const db = require('../db');
const { getNumber } = require('./settings');

const LOCK_MINUTES = 15;
const LOCK_MS = LOCK_MINUTES * 60 * 1000;

function lockRemainingMs(user) {
  if (!user.locked_until) return 0;
  return Math.max(0, Date.parse(user.locked_until) - Date.now());
}

function registerFailure(user) {
  const max = getNumber('login_max_attempts', 5);
  const { failed_attempts: attempts } = db.prepare(
    'UPDATE users SET failed_attempts = failed_attempts + 1 WHERE id = ? RETURNING failed_attempts'
  ).get(user.id);

  if (attempts < max) {
    return { locked: false, attemptsLeft: max - attempts };
  }

  const lockedUntil = new Date(Date.now() + LOCK_MS).toISOString();
  db.prepare('UPDATE users SET failed_attempts = 0, locked_until = ? WHERE id = ?').run(lockedUntil, user.id);
  return { locked: true, lockedUntil };
}

function resetFailures(userId) {
  db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?').run(userId);
}

module.exports = { LOCK_MINUTES, LOCK_MS, lockRemainingMs, registerFailure, resetFailures };
