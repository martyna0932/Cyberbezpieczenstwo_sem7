const db = require('../db');
const { getNumber } = require('./settings');
const { hashPassword, verifyPassword } = require('./password');

async function isPasswordReused(user, password) {
  const count = getNumber('password_history_count', 5);
  const history = db.prepare(
    'SELECT password_hash FROM password_history WHERE user_id = ? ORDER BY id DESC LIMIT ?'
  ).all(user.id, count);

  const hashes = [user.password_hash, ...history.map((row) => row.password_hash)];
  for (const hash of hashes) {
    if (await verifyPassword(hash, password)) return true;
  }
  return false;
}

async function changePassword(userId, newPassword) {
  const hash = await hashPassword(newPassword);

  db.transaction(() => {
    db.prepare(`
      UPDATE users
      SET password_hash = ?, must_change_password = 0, otp_expires_at = NULL,
          password_changed_at = datetime('now')
      WHERE id = ?`).run(hash, userId);
    db.prepare('INSERT INTO password_history (user_id, password_hash) VALUES (?, ?)').run(userId, hash);
  })();
}

function isPasswordExpired(user) {
  const days = getNumber('password_expiry_days', 0);
  if (days <= 0) return false;

  const changedAt = new Date(user.password_changed_at.replace(' ', 'T') + 'Z');
  const expiresAt = changedAt.getTime() + days * 24 * 60 * 60 * 1000;
  return Date.now() > expiresAt;
}

module.exports = { isPasswordReused, changePassword, isPasswordExpired };
