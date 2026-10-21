const config = require('../config');
const users = require('../services/users');
const { isPasswordExpired } = require('../services/passwordChange');

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
    mustChangePassword: user.must_change_password === 1,
    passwordExpired: isPasswordExpired(user),
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

const ALLOWED_PATHS = ['/change-password', '/logout'];

function requirePasswordChange(req, res, next) {
  if (!req.user) return next();
  if (!req.user.mustChangePassword && !req.user.passwordExpired) return next();
  if (ALLOWED_PATHS.includes(req.path)) return next();
  res.redirect('/change-password');
}

module.exports = { loadUser, requireAuth, requirePasswordChange };
