function requirePermission(code) {
  return (req, res, next) => {
    if (!req.user) return res.redirect('/login');
    if (req.user.permissions.includes(code)) return next();

    res.status(403).render('error', {
      title: 'Brak dostępu',
      status: 403,
      message: 'Nie masz uprawnień do tej strony.',
    });
  };
}

module.exports = { requirePermission };
