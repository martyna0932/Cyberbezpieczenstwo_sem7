const config = require('../config');
const users = require('../services/users');

// przy każdym żądaniu pobiera aktualne dane użytkownika z bazy -
// jeśli konto zostało zablokowane lub usunięte, sesja jest kończona
function loadUser(req, res, next) {
  req.user = null;
  res.locals.currentUser = null;

  if (!req.session.userId) return next();

  const user = users.findById(req.session.userId);
  if (!user || user.is_blocked) {
    return req.session.destroy(() => {
      res.clearCookie(config.session.cookieName);
      res.redirect('/login');
    });
  }

  req.user = {
    id: user.id,
    login: user.login,
    fullName: user.full_name,
    roles: users.getRoles(user.id),
    permissions: users.getPermissions(user.id),
  };
  res.locals.currentUser = req.user;
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.redirect('/login');
  next();
}

module.exports = { loadUser, requireAuth };
