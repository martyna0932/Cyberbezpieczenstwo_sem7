const crypto = require('crypto');

// token CSRF trzymany w sesji i dodawany jako ukryte pole do każdego formularza
function csrf(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;

  if (req.method === 'GET' || req.method === 'HEAD') return next();

  const token = req.body && req.body._csrf;
  const expected = req.session.csrfToken;
  const valid =
    typeof token === 'string' &&
    token.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));

  if (!valid) {
    return res.status(403).render('error', {
      title: 'Błąd',
      status: 403,
      message: 'Formularz wygasł. Odśwież stronę i spróbuj ponownie.',
    });
  }
  next();
}

module.exports = csrf;
