const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dataDir = path.join(__dirname, '..', 'data');

function getSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;

  const file = path.join(dataDir, '.session-secret');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();

  const secret = crypto.randomBytes(32).toString('hex');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(file, secret);
  return secret;
}

module.exports = {
  port: Number(process.env.PORT) || 3000,
  dbPath: process.env.DB_PATH || path.join(dataDir, 'app.db'),

  argon2: {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  },

  session: {
    cookieName: 'sid',
    secret: getSessionSecret(),
    secure: process.env.NODE_ENV === 'production',
  },

  maxPasswordLength: 1024,

  turnstile: {
    siteKey: process.env.TURNSTILE_SITE_KEY || '1x00000000000000000000AA',
    secretKey: process.env.TURNSTILE_SECRET_KEY || '1x0000000000000000000000000000000AA',
  },

  canary: {
    honeypotUrl: process.env.CANARY_HONEYPOT_URL || '',
  },
};
