const config = require('../config');
const { getNumber } = require('../services/settings');
const { logEvent } = require('../services/eventLog');

function sessionTimeout(req, res, next) {
  if (!req.session.userId) return next();

  const idleMs = getNumber('session_idle_minutes', 15) * 60 * 1000;
  const now = Date.now();
  const lastActivity = req.session.lastActivity || now;

  if (now - lastActivity > idleMs) {
    const { userId, login } = req.session;
    return req.session.destroy((err) => {
      if (err) return next(err);
      logEvent({ userId, login, type: 'session.timeout', ip: req.ip });
      res.clearCookie(config.session.cookieName);
      res.redirect('/login?reason=timeout');
    });
  }

  req.session.lastActivity = now;
  res.locals.sessionIdleSeconds = idleMs / 1000;
  next();
}

module.exports = sessionTimeout;
