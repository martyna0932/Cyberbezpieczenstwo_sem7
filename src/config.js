const path = require('path');

module.exports = {
  port: Number(process.env.PORT) || 3000,
  dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'app.db'),

  // Parametry Argon2id zgodne z OWASP Password Storage Cheat Sheet
  // (m = 19 MiB, t = 2, p = 1 to minimalna zalecana konfiguracja).
  argon2: {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  },
};
