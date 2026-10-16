PRAGMA foreign_keys = ON;

-- Uzytkownicy. Haslo przechowywane wylacznie jako hash Argon2id
-- (sol jest generowana przez biblioteke i zapisana w samym hashu).
CREATE TABLE IF NOT EXISTS users (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  login                TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  full_name            TEXT    NOT NULL,
  password_hash        TEXT    NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 0,   -- 1 = wymuszona zmiana przy logowaniu
  password_changed_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  otp_expires_at       TEXT,                         -- NULL = haslo nie jest jednorazowe
  is_blocked           INTEGER NOT NULL DEFAULT 0,
  is_system            INTEGER NOT NULL DEFAULT 0,   -- 1 = konto ADMIN, nie mozna go usunac
  totp_secret          TEXT,
  totp_enabled         INTEGER NOT NULL DEFAULT 0,
  created_at           TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- RBAC: uprawnienia przypisane rolom, role przypisane uzytkownikom.
CREATE TABLE IF NOT EXISTS roles (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE IF NOT EXISTS permissions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,   -- np. 'documents.publish'
  description TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- Historia hasel (hashe), uzywana do zakazu powtarzania poprzednich hasel.
CREATE TABLE IF NOT EXISTS password_history (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_password_history_user ON password_history(user_id);

-- Ustawienia polityki edytowane przez administratora (klucz -> wartosc).
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Przykladowy zasob, na ktorym widac dzialanie rol.
CREATE TABLE IF NOT EXISTS documents (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT    NOT NULL,
  content    TEXT    NOT NULL,
  status     TEXT    NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  author_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Sesje po stronie serwera (express-session).
CREATE TABLE IF NOT EXISTS sessions (
  sid     TEXT    PRIMARY KEY,
  sess    TEXT    NOT NULL,
  expires INTEGER NOT NULL
);

-- Dziennik zdarzen (wykorzystywany w kolejnych modulach).
CREATE TABLE IF NOT EXISTS event_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  login      TEXT,                 -- zapisany osobno, bo konto moze zostac usuniete
  event_type TEXT NOT NULL,        -- np. 'login.success', 'login.failure'
  details    TEXT,
  ip         TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_event_log_created ON event_log(created_at);
