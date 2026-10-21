const express = require('express');
const { requireAuth } = require('../middleware/auth');
const users = require('../services/users');
const { verifyPassword } = require('../services/password');
const { getPolicy, validatePassword } = require('../services/passwordPolicy');
const { isPasswordReused, changePassword } = require('../services/passwordChange');
const { getNumber } = require('../services/settings');
const { logEvent } = require('../services/eventLog');

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

    if (!(await verifyPassword(user.password_hash, currentPassword))) {
      return renderForm(req, res, ['Obecne hasło jest niepoprawne.'], 400);
    }

    const errors = validatePassword(newPassword);
    if (newPassword !== confirmPassword) {
      errors.push('Nowe hasło i jego powtórzenie nie są takie same.');
    }
    if (errors.length === 0 && (await isPasswordReused(user, newPassword))) {
      errors.push('Nowe hasło musi różnić się od obecnego i od poprzednich haseł.');
    }
    if (errors.length > 0) {
      return renderForm(req, res, errors, 400);
    }

    await changePassword(req.user.id, newPassword);
    logEvent({ userId: req.user.id, login: req.user.login, type: 'password.change', ip: req.ip });

    req.session.flash = 'Hasło zostało zmienione.';
    res.redirect('/');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
