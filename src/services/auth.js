const crypto = require('crypto');
const config = require('../config');
const users = require('./users');
const { hashPassword, verifyPassword } = require('./password');

const dummyHash = hashPassword(crypto.randomBytes(16).toString('hex'));

async function authenticate(login, password) {
  if (password.length > config.maxPasswordLength) password = '';

  const user = login ? users.findByLogin(login) : null;
  const hash = user ? user.password_hash : await dummyHash;
  const passwordOk = password !== '' && (await verifyPassword(hash, password));

  if (!user) return { ok: false, reason: 'unknown_login' };
  if (!passwordOk) return { ok: false, user, reason: 'bad_password' };
  if (user.is_blocked) return { ok: false, user, reason: 'blocked' };
  if (user.otp_expires_at && new Date(user.otp_expires_at) < new Date()) {
    return { ok: false, user, reason: 'otp_expired' };
  }
  return { ok: true, user };
}

module.exports = { authenticate };
