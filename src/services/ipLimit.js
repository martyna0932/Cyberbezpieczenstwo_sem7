const db = require('../db');
const { getNumber } = require('./settings');

const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;

function blockRemainingMs(ip) {
  const row = db.prepare('SELECT blocked_until FROM ip_attempts WHERE ip = ?').get(ip);
  if (!row || !row.blocked_until) return 0;
  return Math.max(0, row.blocked_until - Date.now());
}

function registerFailure(ip) {
  const max = getNumber('ip_max_attempts', 20);
  const now = Date.now();
  const row = db.prepare('SELECT failures, window_start FROM ip_attempts WHERE ip = ?').get(ip);

  let failures = 1;
  let windowStart = now;
  if (row && now - row.window_start < WINDOW_MS) {
    failures = row.failures + 1;
    windowStart = row.window_start;
  }

  if (failures >= max) {
    db.prepare(`
      INSERT INTO ip_attempts (ip, failures, window_start, blocked_until) VALUES (?, 0, ?, ?)
      ON CONFLICT(ip) DO UPDATE SET failures = 0, window_start = excluded.window_start, blocked_until = excluded.blocked_until
    `).run(ip, now, now + BLOCK_MS);
    return { blocked: true, max };
  }

  db.prepare(`
    INSERT INTO ip_attempts (ip, failures, window_start) VALUES (?, ?, ?)
    ON CONFLICT(ip) DO UPDATE SET failures = excluded.failures, window_start = excluded.window_start
  `).run(ip, failures, windowStart);
  return { blocked: false, attemptsLeft: max - failures };
}

function listBlocked() {
  return db.prepare('SELECT ip, blocked_until FROM ip_attempts WHERE blocked_until > ? ORDER BY blocked_until DESC')
    .all(Date.now());
}

function unblock(ip) {
  return db.prepare('DELETE FROM ip_attempts WHERE ip = ?').run(ip).changes > 0;
}

function unblockAll() {
  return db.prepare('DELETE FROM ip_attempts').run().changes;
}

module.exports = { BLOCK_MS, blockRemainingMs, registerFailure, listBlocked, unblock, unblockAll };
