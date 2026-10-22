const express = require('express');
const config = require('../config');
const { authenticate } = require('../services/auth');
const users = require('../services/users');
const totp = require('../services/totp');
const { logEvent } = require('../services/eventLog');

const router = express.Router();

const TOTP_PENDING_MS = 5 * 60 * 1000;
const TOTP_MAX_ATTEMPTS = 5;

const messages = {
  timeout: 'Wylogowano z powodu bezczynności.',
  logout: 'Wylogowano.',
  totp: 'Logowanie przerwane. Zaloguj się ponownie.',
};

function startSession(req, res, next, user, details = null) {
  req.session.regenerate((err) => {
    if (err) return next(err);
    req.session.userId = user.id;
    req.session.login = user.login;
    req.session.lastActivity = Date.now();
    req.session.save((err) => {
      if (err) return next(err);
      logEvent({ userId: user.id, login: user.login, type: 'login.success', details, ip: req.ip });
      res.redirect('/');
    });
  });
}

router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/');
  res.render('login', {
    title: 'Logowanie',
    info: messages[req.query.reason],
    error: null,
    login: '',
  });
});

router.post('/login', async (req, res, next) => {
  try {
    const login = String(req.body.login || '').trim();
    const password = String(req.body.password || '');
    const result = await authenticate(login, password);

    if (!result.ok) {
      logEvent({
        userId: result.user ? result.user.id : null,
        login: login.slice(0, 64),
        type: 'login.failure',
        details: result.reason,
        ip: req.ip,
      });
      return res.status(401).render('login', {
        title: 'Logowanie',
        info: null,
        error: 'Login lub hasło niepoprawne.',
        login,
      });
    }

    const { user } = result;

    if (!user.totp_enabled) return startSession(req, res, next, user);

    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.totpPending = { userId: user.id, startedAt: Date.now(), attempts: 0 };
      req.session.save((err) => {
        if (err) return next(err);
        res.redirect('/login/2fa');
      });
    });
  } catch (err) {
    next(err);
  }
});

function getPending(req) {
  const pending = req.session.totpPending;
  if (!pending || Date.now() - pending.startedAt > TOTP_PENDING_MS) return null;
  return pending;
}

router.get('/login/2fa', (req, res) => {
  if (!getPending(req)) return res.redirect('/login?reason=totp');
  res.render('login-2fa', { title: 'Weryfikacja dwuetapowa', error: null });
});

router.post('/login/2fa', (req, res, next) => {
  const pending = getPending(req);
  if (!pending) {
    delete req.session.totpPending;
    return res.redirect('/login?reason=totp');
  }

  const user = users.findById(pending.userId);
  if (user && user.totp_enabled && !user.is_blocked && totp.verifyCode(user.totp_secret, req.body.code)) {
    return startSession(req, res, next, user, 'totp');
  }

  pending.attempts += 1;
  logEvent({
    userId: pending.userId,
    login: user ? user.login : null,
    type: 'login.failure',
    details: 'bad_totp',
    ip: req.ip,
  });

  if (pending.attempts >= TOTP_MAX_ATTEMPTS) {
    delete req.session.totpPending;
    return res.redirect('/login?reason=totp');
  }

  res.status(401).render('login-2fa', { title: 'Weryfikacja dwuetapowa', error: 'Nieprawidłowy kod.' });
});

router.post('/logout', (req, res, next) => {
  const { userId, login } = req.session;
  req.session.destroy((err) => {
    if (err) return next(err);
    if (userId) logEvent({ userId, login, type: 'logout', ip: req.ip });
    res.clearCookie(config.session.cookieName);
    res.redirect('/login?reason=logout');
  });
});

module.exports = router;
