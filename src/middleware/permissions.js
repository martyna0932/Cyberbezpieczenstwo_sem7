const { logEvent } = require('../services/eventLog');

function forbidden(req, res) {
  logEvent({
    userId: req.user ? req.user.id : null,
    login: req.user ? req.user.login : null,
    type: 'access.denied',
    details: `${req.method} ${req.originalUrl}`,
    ip: req.ip,
  });

  res.status(403).render('error', {
    title: 'Brak dostępu',
    status: 403,
    message: 'Nie masz uprawnień do tej strony.',
  });
}

function requirePermission(code) {
  return (req, res, next) => {
    if (!req.user) return res.redirect('/login');
    if (req.user.permissions.includes(code)) return next();
    forbidden(req, res);
  };
}

module.exports = { requirePermission, forbidden };
