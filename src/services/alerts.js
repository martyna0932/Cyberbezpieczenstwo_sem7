const db = require('../db');
const { readEntries, clean } = require('./securityLog');
const { LOGIN_REASONS } = require('./eventLabels');

const MINUTE = 60 * 1000;
const LOCKED_REASONS = [LOGIN_REASONS.locked, LOGIN_REASONS.blocked];

const RULES = [
  {
    id: 'alert.failed_logins',
    title: 'Wiele nieudanych logowań na jedno konto',
    threshold: 5,
    windowMs: 5 * MINUTE,
    matches: () => true,
    message: (login, count) => `${count} nieudanych prób logowania na konto ${login} w ciągu 5 minut`,
  },
  {
    id: 'alert.locked_account',
    title: 'Próby logowania na zablokowane konto',
    threshold: 3,
    windowMs: 10 * MINUTE,
    matches: (entry) => LOCKED_REASONS.includes(entry.desc),
    message: (login, count) => `${count} próby logowania na zablokowane konto ${login} w ciągu 10 minut`,
  },
];

function alreadyAlerted(rule, login, now) {
  return db.prepare('SELECT 1 FROM notifications WHERE rule = ? AND login = ? AND created_at > ?')
    .get(rule.id, login, now - rule.windowMs);
}

function evaluateLoginFailure(rawLogin, ip) {
  const login = clean(rawLogin, 64);
  if (login === '-') return;

  const now = Date.now();
  const failures = readEntries().filter((e) => e.action === 'login.failure' && e.user === login);

  for (const rule of RULES) {
    const count = failures.filter((e) => now - Date.parse(e.time) <= rule.windowMs && rule.matches(e)).length;
    if (count < rule.threshold || alreadyAlerted(rule, login, now)) continue;

    const message = rule.message(login, count);
    db.prepare('INSERT INTO notifications (rule, login, title, message, ip, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(rule.id, login, rule.title, message, ip || null, now);
    require('./eventLog').logEvent({ login, type: rule.id, details: message, ip, result: 'ALERT' });
  }
}

function listNotifications(limit = 100) {
  return db.prepare('SELECT * FROM notifications ORDER BY id DESC LIMIT ?').all(limit);
}

function unreadCount() {
  return db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE read_at IS NULL').get().n;
}

function markRead(id) {
  db.prepare('UPDATE notifications SET read_at = ? WHERE id = ? AND read_at IS NULL').run(Date.now(), id);
}

function markAllRead() {
  db.prepare('UPDATE notifications SET read_at = ? WHERE read_at IS NULL').run(Date.now());
}

module.exports = { RULES, evaluateLoginFailure, listNotifications, unreadCount, markRead, markAllRead };
