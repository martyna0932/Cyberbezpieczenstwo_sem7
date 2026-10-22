const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const db = require('../db');

const ISSUER = 'System dokumentow';

authenticator.options = { window: 1 };

function generateSecret() {
  return authenticator.generateSecret();
}

function qrCodeFor(login, secret) {
  return QRCode.toDataURL(authenticator.keyuri(login, ISSUER, secret));
}

function verifyCode(secret, code) {
  const token = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(token)) return false;
  try {
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}

function enable(userId, secret) {
  db.prepare('UPDATE users SET totp_secret = ?, totp_enabled = 1 WHERE id = ?').run(secret, userId);
}

function disable(userId) {
  db.prepare('UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?').run(userId);
}

module.exports = { generateSecret, qrCodeFor, verifyCode, enable, disable };
