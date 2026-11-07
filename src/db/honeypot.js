const crypto = require('crypto');
const { hashPassword } = require('../services/password');

const HONEYPOT_LOGIN = 'backup_admin';
const HONEYPOT_NAME = 'Konto serwisowe kopii zapasowych';

async function createHoneypot(db) {
  if (db.prepare('SELECT 1 FROM users WHERE login = ?').get(HONEYPOT_LOGIN)) return false;
  const hash = await hashPassword(crypto.randomBytes(32).toString('hex'));
  db.prepare(`
    INSERT INTO users (login, full_name, password_hash, is_system, is_honeypot)
    VALUES (?, ?, ?, 1, 1)`).run(HONEYPOT_LOGIN, HONEYPOT_NAME, hash);
  return true;
}

if (require.main === module) {
  const db = require('./index');
  createHoneypot(db).then((created) => {
    console.log(created ? `Utworzono konto-pułapkę ${HONEYPOT_LOGIN}.` : `Konto ${HONEYPOT_LOGIN} już istnieje.`);
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { createHoneypot, HONEYPOT_LOGIN };
