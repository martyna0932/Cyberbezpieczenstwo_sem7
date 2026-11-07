const DEFAULT_SETTINGS = {
  login_max_attempts: '5',
};

function addColumn(db, table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function migrate(db) {
  addColumn(db, 'users', 'failed_attempts', 'INTEGER NOT NULL DEFAULT 0');
  addColumn(db, 'users', 'locked_until', 'TEXT');
  addColumn(db, 'users', 'is_honeypot', 'INTEGER NOT NULL DEFAULT 0');

  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    insertSetting.run(key, value);
  }
}

module.exports = migrate;
