const session = require('express-session');

const DAY_MS = 24 * 60 * 60 * 1000;

class SqliteSessionStore extends session.Store {
  constructor(db) {
    super();
    this.getStmt = db.prepare('SELECT sess FROM sessions WHERE sid = ? AND expires > ?');
    this.setStmt = db.prepare(`
      INSERT INTO sessions (sid, sess, expires) VALUES (?, ?, ?)
      ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires`);
    this.destroyStmt = db.prepare('DELETE FROM sessions WHERE sid = ?');
    this.touchStmt = db.prepare('UPDATE sessions SET expires = ? WHERE sid = ?');
    this.cleanupStmt = db.prepare('DELETE FROM sessions WHERE expires <= ?');

    this.cleanup();
    setInterval(() => this.cleanup(), 15 * 60 * 1000).unref();
  }

  cleanup() {
    this.cleanupStmt.run(Date.now());
  }

  expires(sess) {
    if (sess.cookie && sess.cookie.expires) return new Date(sess.cookie.expires).getTime();
    return Date.now() + DAY_MS;
  }

  get(sid, callback) {
    try {
      const row = this.getStmt.get(sid, Date.now());
      callback(null, row ? JSON.parse(row.sess) : null);
    } catch (err) {
      callback(err);
    }
  }

  set(sid, sess, callback = () => {}) {
    try {
      this.setStmt.run(sid, JSON.stringify(sess), this.expires(sess));
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  destroy(sid, callback = () => {}) {
    try {
      this.destroyStmt.run(sid);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  touch(sid, sess, callback = () => {}) {
    try {
      this.touchStmt.run(this.expires(sess), sid);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }
}

module.exports = SqliteSessionStore;
