const express = require('express');
const { requirePermission } = require('../middleware/permissions');
const admin = require('../services/adminUsers');
const users = require('../services/users');
const { getAllSettings, setSetting } = require('../services/settings');
const { logEvent } = require('../services/eventLog');

const router = express.Router();
const canManageUsers = requirePermission('users.manage');
const canManageSettings = requirePermission('settings.manage');

function readUserForm(body) {
  return {
    login: String(body.login || '').trim(),
    fullName: String(body.fullName || '').trim(),
    roleId: Number(body.roleId),
  };
}

function log(req, type, target) {
  logEvent({
    userId: req.user.id,
    login: req.user.login,
    type,
    details: target ? `konto: ${target.login}` : null,
    ip: req.ip,
  });
}

function findEditableUser(req, res) {
  const user = users.findById(Number(req.params.id));
  if (!user) {
    res.status(404).render('error', { title: 'Nie znaleziono', status: 404, message: 'Nie ma takiego użytkownika.' });
    return null;
  }
  return user;
}

function rejectProtected(req, res, user) {
  if (user.is_system || user.id === req.user.id) {
    req.session.flash = 'Tej operacji nie można wykonać na koncie ADMIN ani na własnym koncie.';
    res.redirect('/admin/users');
    return true;
  }
  return false;
}

function showOneTimePassword(req, login, result) {
  req.session.oneTimePassword = {
    login,
    password: result.password,
    expiresAt: result.expiresAt.toLocaleString('pl-PL'),
  };
}

router.get('/admin', canManageUsers, (req, res) => res.redirect('/admin/users'));

router.get('/admin/users', canManageUsers, (req, res) => {
  const oneTimePassword = req.session.oneTimePassword;
  delete req.session.oneTimePassword;

  res.render('admin/users', {
    title: 'Użytkownicy',
    users: admin.listUsers(),
    oneTimePassword,
  });
});

router.get('/admin/users/new', canManageUsers, (req, res) => {
  res.render('admin/user-form', {
    title: 'Nowy użytkownik',
    user: null,
    form: { login: '', fullName: '', roleId: null },
    roles: admin.listRoles(),
    errors: [],
  });
});

router.post('/admin/users', canManageUsers, async (req, res, next) => {
  try {
    const form = readUserForm(req.body);
    const errors = admin.validateUser(form);
    if (errors.length > 0) {
      return res.status(400).render('admin/user-form', {
        title: 'Nowy użytkownik', user: null, form, roles: admin.listRoles(), errors,
      });
    }

    const result = await admin.createUser(form);
    log(req, 'user.create', form);
    showOneTimePassword(req, form.login, result);
    res.redirect('/admin/users');
  } catch (err) {
    next(err);
  }
});

router.get('/admin/users/:id/edit', canManageUsers, (req, res) => {
  const user = findEditableUser(req, res);
  if (!user) return;

  res.render('admin/user-form', {
    title: 'Edycja użytkownika',
    user,
    form: { login: user.login, fullName: user.full_name, roleId: admin.getUserRoleId(user.id) },
    roles: admin.listRoles(),
    errors: [],
  });
});

router.post('/admin/users/:id', canManageUsers, (req, res) => {
  const user = findEditableUser(req, res);
  if (!user) return;

  const form = { ...readUserForm(req.body), login: user.login };
  if (user.is_system || user.id === req.user.id) form.roleId = admin.getUserRoleId(user.id);

  const errors = admin.validateUser(form, { checkLogin: false });
  if (errors.length > 0) {
    return res.status(400).render('admin/user-form', {
      title: 'Edycja użytkownika', user, form, roles: admin.listRoles(), errors,
    });
  }

  admin.updateUser(user.id, form);
  log(req, 'user.update', user);
  req.session.flash = `Zapisano zmiany konta ${user.login}.`;
  res.redirect('/admin/users');
});

router.post('/admin/users/:id/block', canManageUsers, (req, res) => {
  const user = findEditableUser(req, res);
  if (!user || rejectProtected(req, res, user)) return;

  const block = !user.is_blocked;
  admin.setBlocked(user.id, block);
  log(req, block ? 'user.block' : 'user.unblock', user);
  req.session.flash = block ? `Zablokowano konto ${user.login}.` : `Odblokowano konto ${user.login}.`;
  res.redirect('/admin/users');
});

router.post('/admin/users/:id/reset-password', canManageUsers, async (req, res, next) => {
  try {
    const user = findEditableUser(req, res);
    if (!user || rejectProtected(req, res, user)) return;

    const result = await admin.resetPassword(user.id);
    log(req, 'user.reset_password', user);
    showOneTimePassword(req, user.login, result);
    res.redirect('/admin/users');
  } catch (err) {
    next(err);
  }
});

router.post('/admin/users/:id/disable-2fa', canManageUsers, (req, res) => {
  const user = findEditableUser(req, res);
  if (!user || rejectProtected(req, res, user)) return;

  admin.disableTwoFactor(user.id);
  log(req, 'user.disable_2fa', user);
  req.session.flash = `Wyłączono weryfikację dwuetapową konta ${user.login}.`;
  res.redirect('/admin/users');
});

router.get('/admin/users/:id/delete', canManageUsers, (req, res) => {
  const user = findEditableUser(req, res);
  if (!user || rejectProtected(req, res, user)) return;
  res.render('admin/user-delete', { title: 'Usuwanie użytkownika', user });
});

router.post('/admin/users/:id/delete', canManageUsers, (req, res) => {
  const user = findEditableUser(req, res);
  if (!user || rejectProtected(req, res, user)) return;

  admin.deleteUser(user.id);
  log(req, 'user.delete', user);
  req.session.flash = `Usunięto konto ${user.login}.`;
  res.redirect('/admin/users');
});

const SETTINGS = {
  password_min_length: { min: 8, max: 64, label: 'Minimalna długość hasła' },
  password_expiry_days: { min: 0, max: 365, label: 'Ważność hasła (dni)' },
  password_history_count: { min: 0, max: 24, label: 'Liczba zapamiętanych haseł' },
  session_idle_minutes: { min: 1, max: 480, label: 'Czas bezczynności sesji (minuty)' },
};

function renderSettings(res, values, errors = [], status = 200) {
  res.status(status).render('admin/settings', { title: 'Ustawienia', values, errors, fields: SETTINGS });
}

router.get('/admin/settings', canManageSettings, (req, res) => {
  renderSettings(res, getAllSettings());
});

router.post('/admin/settings', canManageSettings, (req, res) => {
  const values = { ...getAllSettings() };
  const errors = [];

  for (const [key, field] of Object.entries(SETTINGS)) {
    const raw = String(req.body[key] || '').trim();
    const value = Number(raw);
    values[key] = raw;
    if (!/^\d+$/.test(raw) || value < field.min || value > field.max) {
      errors.push(`${field.label}: podaj liczbę od ${field.min} do ${field.max}.`);
    }
  }
  values.passphrase_rule_enabled = req.body.passphrase_rule_enabled === '1' ? '1' : '0';

  if (errors.length > 0) return renderSettings(res, values, errors, 400);

  for (const key of [...Object.keys(SETTINGS), 'passphrase_rule_enabled']) {
    setSetting(key, values[key]);
  }
  log(req, 'settings.update');
  req.session.flash = 'Ustawienia zostały zapisane.';
  res.redirect('/admin/settings');
});

module.exports = router;
