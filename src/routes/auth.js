const express = require('express');
const config = require('../config');
const { authenticate } = require('../services/auth');
const { logEvent } = require('../services/eventLog');

const router = express.Router();

const messages = {
  timeout: 'Wylogowano z powodu bezczynności.',
  logout: 'Wylogowano.',
};

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

    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.userId = user.id;
      req.session.login = user.login;
      req.session.lastActivity = Date.now();
      req.session.save((err) => {
        if (err) return next(err);
        logEvent({ userId: user.id, login: user.login, type: 'login.success', ip: req.ip });
        res.redirect('/');
      });
    });
  } catch (err) {
    next(err);
  }
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
