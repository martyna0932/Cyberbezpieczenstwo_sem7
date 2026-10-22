const express = require('express');
const { requireAuth } = require('../middleware/auth');
const users = require('../services/users');
const totp = require('../services/totp');
const { verifyPassword } = require('../services/password');
const { logEvent } = require('../services/eventLog');

const router = express.Router();

function log(req, type) {
  logEvent({ userId: req.user.id, login: req.user.login, type, ip: req.ip });
}

async function renderSetup(req, res, error = null, status = 200) {
  const secret = req.session.totpSetupSecret;
  res.status(status).render('two-factor', {
    title: 'Weryfikacja dwuetapowa',
    enabled: false,
    setup: { secret, qrCode: await totp.qrCodeFor(req.user.login, secret) },
    error,
  });
}

router.get('/account/2fa', requireAuth, (req, res) => {
  const user = users.findById(req.user.id);
  res.render('two-factor', {
    title: 'Weryfikacja dwuetapowa',
    enabled: user.totp_enabled === 1,
    setup: null,
    error: null,
  });
});

router.post('/account/2fa/setup', requireAuth, async (req, res, next) => {
  try {
    req.session.totpSetupSecret = totp.generateSecret();
    await renderSetup(req, res);
  } catch (err) {
    next(err);
  }
});

router.post('/account/2fa/enable', requireAuth, async (req, res, next) => {
  try {
    const secret = req.session.totpSetupSecret;
    if (!secret) return res.redirect('/account/2fa');

    if (!totp.verifyCode(secret, req.body.code)) {
      return await renderSetup(req, res, 'Nieprawidłowy kod. Sprawdź, czy czas w telefonie jest ustawiony automatycznie.', 400);
    }

    totp.enable(req.user.id, secret);
    delete req.session.totpSetupSecret;
    log(req, 'totp.enable');
    req.session.flash = 'Weryfikacja dwuetapowa została włączona.';
    res.redirect('/account/2fa');
  } catch (err) {
    next(err);
  }
});

router.post('/account/2fa/disable', requireAuth, async (req, res, next) => {
  try {
    const user = users.findById(req.user.id);
    const passwordOk = await verifyPassword(user.password_hash, String(req.body.password || ''));
    const codeOk = totp.verifyCode(user.totp_secret, req.body.code);

    if (!passwordOk || !codeOk) {
      return res.status(400).render('two-factor', {
        title: 'Weryfikacja dwuetapowa',
        enabled: true,
        setup: null,
        error: 'Nieprawidłowe hasło lub kod.',
      });
    }

    totp.disable(user.id);
    log(req, 'totp.disable');
    req.session.flash = 'Weryfikacja dwuetapowa została wyłączona.';
    res.redirect('/account/2fa');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
