const argon2 = require('argon2');
const config = require('../config');

function hashPassword(password) {
  return argon2.hash(password, { type: argon2.argon2id, ...config.argon2 });
}

async function verifyPassword(hash, password) {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword };
