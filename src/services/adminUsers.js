const db = require('../db');
const { hashPassword } = require('./password');
const { generateOneTimePassword, otpExpiryDate } = require('./otp');

const LOGIN_PATTERN = /^[a-zA-Z0-9._-]{3,32}$/;

function listUsers() {
  return db.prepare(`
    SELECT u.id, u.login, u.full_name, u.is_blocked, u.is_system, u.must_change_password, u.totp_enabled,
           u.otp_expires_at, u.created_at, GROUP_CONCAT(r.name, ', ') AS roles
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    GROUP BY u.id
    ORDER BY u.id`).all();
}

function listRoles() {
  return db.prepare('SELECT id, name FROM roles ORDER BY id').all();
}

function getUserRoleId(userId) {
  const row = db.prepare('SELECT role_id FROM user_roles WHERE user_id = ?').get(userId);
  return row ? row.role_id : null;
}

function validateUser({ login, fullName, roleId }, { checkLogin = true } = {}) {
  const errors = [];
  if (checkLogin) {
    if (!LOGIN_PATTERN.test(login)) {
      errors.push('Login musi mieć 3-32 znaki: litery, cyfry, kropka, myślnik lub podkreślenie.');
    } else if (db.prepare('SELECT 1 FROM users WHERE login = ?').get(login)) {
      errors.push('Użytkownik o takim loginie już istnieje.');
    }
  }
  if (fullName.length < 1 || fullName.length > 100) {
    errors.push('Imię i nazwisko jest wymagane (maks. 100 znaków).');
  }
  if (!db.prepare('SELECT 1 FROM roles WHERE id = ?').get(roleId)) {
    errors.push('Wybierz rolę.');
  }
  return errors;
}

async function newOneTimePassword() {
  const password = generateOneTimePassword();
  const expiresAt = otpExpiryDate();
  const hash = await hashPassword(password);
  return { password, expiresAt, hash };
}

async function createUser({ login, fullName, roleId }) {
  const otp = await newOneTimePassword();

  const userId = db.transaction(() => {
    const id = db.prepare(`
      INSERT INTO users (login, full_name, password_hash, must_change_password, otp_expires_at)
      VALUES (?, ?, ?, 1, ?)`).run(login, fullName, otp.hash, otp.expiresAt.toISOString()).lastInsertRowid;
    db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').run(id, roleId);
    return id;
  })();

  return { userId, password: otp.password, expiresAt: otp.expiresAt };
}

function updateUser(userId, { fullName, roleId }) {
  db.transaction(() => {
    db.prepare('UPDATE users SET full_name = ? WHERE id = ?').run(fullName, userId);
    db.prepare('DELETE FROM user_roles WHERE user_id = ?').run(userId);
    db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').run(userId, roleId);
  })();
}

function setBlocked(userId, blocked) {
  db.prepare('UPDATE users SET is_blocked = ? WHERE id = ?').run(blocked ? 1 : 0, userId);
}

function disableTwoFactor(userId) {
  db.prepare('UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?').run(userId);
}

function deleteUser(userId) {
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
}

async function resetPassword(userId) {
  const otp = await newOneTimePassword();
  db.prepare(`
    UPDATE users
    SET password_hash = ?, must_change_password = 1, otp_expires_at = ?, password_changed_at = datetime('now')
    WHERE id = ?`).run(otp.hash, otp.expiresAt.toISOString(), userId);
  return { password: otp.password, expiresAt: otp.expiresAt };
}

module.exports = {
  listUsers,
  listRoles,
  getUserRoleId,
  validateUser,
  createUser,
  updateUser,
  setBlocked,
  disableTwoFactor,
  deleteUser,
  resetPassword,
};
