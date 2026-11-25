const express = require('express');
const { requireAuth } = require('../middleware/auth');
const users = require('../services/users');
const { verifyPassword } = require('../services/password');
const { getPolicy, validatePassword } = require('../services/passwordPolicy');
const { isPasswordReused, changePassword } = require('../services/passwordChange');
const { getNumber } = require('../services/settings');
const { logEvent } = require('../services/eventLog');
const { verifyTurnstile } = require('../services/turnstile');

const router = express.Router();

function renderForm(req, res, errors = [], status = 200) {
  let notice = null;
  if (req.user.mustChangePassword) {
    notice = 'To Twoje pierwsze logowanie hasłem nadanym przez administratora. Ustaw własne hasło.';
  } else if (req.user.passwordExpired) {
    notice = 'Twoje hasło wygasło. Ustaw nowe hasło.';
  }

  res.status(status).render('change-password', {
    title: 'Zmiana hasła',
    notice,
    errors,
    policy: getPolicy(),
    historyCount: getNumber('password_history_count', 5),
  });
}

router.get('/change-password', requireAuth, (req, res) => {
  renderForm(req, res);
});

router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');
    const confirmPassword = String(req.body.confirmPassword || '');
    const user = users.findById(req.user.id);

    const captcha = await verifyTurnstile(req.body['cf-turnstile-response']);
    if (!captcha.success) {
      logEvent({
        login: user.login,
        type: 'captcha.failure',
        details: `change-password: ${captcha.errors.join(',')}`,
        ip: req.ip,
      });
      return renderForm(req, res, ['Weryfikacja CAPTCHA nie powiodła się. Spróbuj ponownie.'], 400);
    }

    const fail = (reason, messages) => {
      logEvent({ login: user.login, type: 'password.change_failed', details: reason, ip: req.ip });
      return renderForm(req, res, messages, 400);
    };

    if (!(await verifyPassword(user.password_hash, currentPassword))) {
      return fail('błędne obecne hasło', ['Obecne hasło jest niepoprawne.']);
    }

    const errors = validatePassword(newPassword);
    const reasons = errors.length > 0 ? ['nowe hasło nie spełnia polityki haseł'] : [];
    if (newPassword !== confirmPassword) {
      errors.push('Nowe hasło i jego powtórzenie nie są takie same.');
      reasons.push('powtórzenie nowego hasła się nie zgadza');
    }
    if (errors.length === 0 && (await isPasswordReused(user, newPassword))) {
      errors.push('Nowe hasło musi różnić się od obecnego i od poprzednich haseł.');
      reasons.push('nowe hasło było już używane');
    }
    if (errors.length > 0) {
      return fail(reasons.join(', '), errors);
    }

    await changePassword(req.user.id, newPassword);
    logEvent({ login: req.user.login, type: 'password.change', ip: req.ip });

    req.session.flash = 'Hasło zostało zmienione.';
    res.redirect('/');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
