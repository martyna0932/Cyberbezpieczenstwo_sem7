const express = require('express');
const { requirePermission } = require('../middleware/permissions');
const admin = require('../services/adminUsers');
const users = require('../services/users');
const lockout = require('../services/lockout');
const ipLimit = require('../services/ipLimit');
const { getAllSettings, setSetting } = require('../services/settings');
const { logEvent, filterEvents, listEventTypes, listEventUsers } = require('../services/eventLog');
const { verifyChain } = require('../services/securityLog');
const alerts = require('../services/alerts');

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

function log(req, type, details = null) {
  logEvent({ login: req.user.login, type, details, ip: req.ip });
}

function roleName(roleId) {
  const role = admin.listRoles().find((r) => r.id === roleId);
  return role ? role.name : 'brak';
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
    log(req, 'access.denied', `operacja na chronionym koncie ${user.login}`);
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
    log(req, 'user.create', `utworzono konto ${form.login} z rolą ${roleName(form.roleId)}`);
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

  const oldRoleId = admin.getUserRoleId(user.id);
  admin.updateUser(user.id, form);
  if (oldRoleId !== form.roleId) {
    log(req, 'user.role_change', `konto ${user.login}: ${roleName(oldRoleId)} → ${roleName(form.roleId)}`);
  }
  if (user.full_name !== form.fullName) {
    log(req, 'user.update', `konto ${user.login}: zmieniono imię i nazwisko`);
  }
  req.session.flash = `Zapisano zmiany konta ${user.login}.`;
  res.redirect('/admin/users');
});

router.post('/admin/users/:id/unlock', canManageUsers, (req, res) => {
  const user = findEditableUser(req, res);
  if (!user) return;

  lockout.resetFailures(user.id);
  log(req, 'user.unlock_login', `zdjęto blokadę logowania konta ${user.login}`);
  req.session.flash = `Zdjęto blokadę logowania konta ${user.login}.`;
  res.redirect('/admin/users');
});

router.post('/admin/users/:id/block', canManageUsers, (req, res) => {
  const user = findEditableUser(req, res);
  if (!user || rejectProtected(req, res, user)) return;

  const block = !user.is_blocked;
  admin.setBlocked(user.id, block);
  log(req, block ? 'user.block' : 'user.unblock', `${block ? 'zablokowano' : 'odblokowano'} konto ${user.login}`);
  req.session.flash = block ? `Zablokowano konto ${user.login}.` : `Odblokowano konto ${user.login}.`;
  res.redirect('/admin/users');
});

router.post('/admin/users/:id/reset-password', canManageUsers, async (req, res, next) => {
  try {
    const user = findEditableUser(req, res);
    if (!user || rejectProtected(req, res, user)) return;

    const result = await admin.resetPassword(user.id);
    log(req, 'user.reset_password', `nadano nowe hasło jednorazowe dla konta ${user.login}`);
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
  log(req, 'user.disable_2fa', `wyłączono weryfikację dwuetapową konta ${user.login}`);
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
  log(req, 'user.delete', `usunięto konto ${user.login}`);
  req.session.flash = `Usunięto konto ${user.login}.`;
  res.redirect('/admin/users');
});

const SETTINGS = {
  password_min_length: { min: 8, max: 64, label: 'Minimalna długość hasła' },
  login_max_attempts: { min: 3, max: 20, label: 'Liczba błędnych prób logowania przed blokadą konta' },
  ip_max_attempts: { min: 5, max: 100, label: 'Liczba nieudanych prób logowania z jednego adresu IP' },
  password_expiry_days: { min: 0, max: 365, label: 'Ważność hasła (dni)' },
  password_history_count: { min: 0, max: 24, label: 'Liczba zapamiętanych haseł' },
  session_idle_minutes: { min: 1, max: 480, label: 'Czas bezczynności sesji (minuty)' },
};

function renderSettings(res, values, errors = [], status = 200) {
  res.status(status).render('admin/settings', {
    title: 'Ustawienia',
    values,
    errors,
    fields: SETTINGS,
    blockedIps: ipLimit.listBlocked(),
  });
}

const DISPLAY_LIMIT = 200;

function readEventFilters(query) {
  const types = listEventTypes();
  const usersInLog = listEventUsers();
  const date = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '');
  return {
    types,
    usersInLog,
    filters: {
      type: types.includes(query.type) ? query.type : '',
      user: usersInLog.includes(query.user) ? query.user : '',
      from: date(query.from),
      to: date(query.to),
    },
  };
}

function describeFilters(filters) {
  const parts = Object.entries(filters).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`);
  return parts.length ? parts.join(', ') : 'bez filtrów';
}

router.get('/admin/events', canManageSettings, (req, res) => {
  const { types, usersInLog, filters } = readEventFilters(req.query);
  const events = filterEvents(filters).reverse();
  const integrity = req.session.integrity || null;
  delete req.session.integrity;
  res.render('admin/events', {
    integrity,
    title: 'Dziennik zdarzeń',
    events: events.slice(0, DISPLAY_LIMIT),
    total: events.length,
    limit: DISPLAY_LIMIT,
    types,
    usersInLog,
    filters,
    query: new URLSearchParams(filters).toString(),
  });
});

router.post('/admin/events/verify', canManageSettings, (req, res) => {
  const result = verifyChain();
  if (result.ok) {
    log(req, 'log.verify', `dziennik nienaruszony, sprawdzono ${result.total} wpisów`);
  } else {
    const lines = result.broken.map((b) => b.line).join(', ');
    logEvent({
      login: req.user.login,
      type: 'log.verify',
      details: `wykryto naruszenie integralności w liniach: ${lines}`,
      ip: req.ip,
      result: 'BŁĄD',
    });
  }
  req.session.integrity = { ...result, broken: result.broken.slice(0, 20), checkedAt: new Date().toISOString() };
  res.redirect('/admin/events');
});

router.get('/admin/events/export', canManageSettings, (req, res) => {
  const { filters } = readEventFilters(req.query);
  const events = filterEvents(filters);
  log(req, 'log.export', `wyeksportowano ${events.length} wpisów (${describeFilters(filters)})`);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-');
  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="security-log-${stamp}.log"`);
  res.send(events.map((e) => e.raw).join('\n') + (events.length ? '\n' : ''));
});

router.get('/admin/alerts', canManageSettings, (req, res) => {
  res.render('admin/alerts', {
    title: 'Alerty bezpieczeństwa',
    notifications: alerts.listNotifications(),
  });
});

router.post('/admin/alerts/read-all', canManageSettings, (req, res) => {
  alerts.markAllRead();
  res.redirect('/admin/alerts');
});

router.post('/admin/alerts/:id/read', canManageSettings, (req, res) => {
  alerts.markRead(Number(req.params.id));
  res.redirect('/admin/alerts');
});

router.get('/admin/settings', canManageSettings, (req, res) => {
  renderSettings(res, getAllSettings());
});

router.post('/admin/settings', canManageSettings, (req, res) => {
  const before = getAllSettings();
  const values = { ...before };
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
  const changes = Object.keys(values)
    .filter((key) => String(before[key]) !== String(values[key]))
    .map((key) => `${key}: ${before[key]} → ${values[key]}`);
  log(req, 'settings.update', changes.length ? changes.join(', ') : 'brak zmian');
  req.session.flash = 'Ustawienia zostały zapisane.';
  res.redirect('/admin/settings');
});

router.post('/admin/ip-blocks/unblock', canManageSettings, (req, res) => {
  const ip = String(req.body.ip || '');
  if (ipLimit.unblock(ip)) {
    log(req, 'ip.unblock', ip);
    req.session.flash = `Odblokowano adres ${ip}.`;
  }
  res.redirect('/admin/settings');
});

module.exports = router;
