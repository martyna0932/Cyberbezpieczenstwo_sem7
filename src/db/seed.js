
const fs = require('fs');
const config = require('../config');

if (process.argv.includes('--reset')) {
  for (const suffix of ['', '-wal', '-shm']) {
    fs.rmSync(config.dbPath + suffix, { force: true });
  }
  console.log('Usunięto istniejącą baze.');
}

const argon2 = require('argon2');
const db = require('./index');
const { generateOneTimePassword, otpExpiryDate } = require('../services/otp');

const ROLES = [
  { name: 'Administrator', description: 'Zarządzanie użytkownikami i polityka bezpieczeństwa' },
  { name: 'Kierownik', description: 'Zarządzanie wszystkimi dokumentami, publikowanie' },
  { name: 'Redaktor', description: 'Tworzenie i edycja własnych dokumentów' },
  { name: 'Czytelnik', description: 'Odczyt opublikowanych dokumentów' },
];

const PERMISSIONS = [
  { code: 'documents.read', description: 'Odczyt opublikowanych dokumentów' },
  { code: 'documents.create', description: 'Tworzenie szkiców' },
  { code: 'documents.edit_own', description: 'Edycja własnych dokumentów' },
  { code: 'documents.edit_any', description: 'Edycja dokumentów innych autorów' },
  { code: 'documents.publish', description: 'Publikowanie dokumentów' },
  { code: 'documents.delete', description: 'Usuwanie dokumentów' },
  { code: 'users.manage', description: 'Zarządzanie kontami użytkowników' },
  { code: 'settings.manage', description: 'Zmiana polityki haseł i ustawień sesji' },
  { code: 'profile.change_password', description: 'Zmiana własnego hasła' },
];


const ROLE_PERMISSIONS = {
  Administrator: ['documents.read', 'users.manage', 'settings.manage', 'profile.change_password'],
  Kierownik: [
    'documents.read', 'documents.create', 'documents.edit_own', 'documents.edit_any',
    'documents.publish', 'documents.delete', 'profile.change_password',
  ],
  Redaktor: ['documents.read', 'documents.create', 'documents.edit_own', 'profile.change_password'],
  Czytelnik: ['documents.read', 'profile.change_password'],
};

const DEFAULT_SETTINGS = {
  password_min_length: '15',
  password_max_length: '128',
  passphrase_rule_enabled: '0',      
  passphrase_min_words: '3',
  password_expiry_days: '0',         
  password_history_count: '5',
  session_idle_minutes: '15',
};

const TEST_USERS = [
  { login: 'jkowalski', fullName: 'Jan Kowalski', role: 'Kierownik', password: 'kowal-haslo-12333' },
  { login: 'anowak', fullName: 'Anna Nowak', role: 'Kierownik', oneTime: true },
  { login: 'pwisniewski', fullName: 'Piotr Wisniewski', role: 'Redaktor', password: 'wisnia-haslo-12333' },
  { login: 'mwojcik', fullName: 'Maria Wojcik', role: 'Redaktor', oneTime: true },
  { login: 'tkaminski', fullName: 'Tomasz Kaminski', role: 'Czytelnik', password: 'kamien-haslo-12333' },
  { login: 'klewandowska', fullName: 'Katarzyna Lewandowska', role: 'Czytelnik', password: 'lewy-haslo-123333' },
  { login: 'mzielinski', fullName: 'Marek Zielinski', role: 'Czytelnik', password: 'ziolo-haslo-12333' },
];

const SAMPLE_DOCUMENTS = [
  { title: 'Regulamin pracowni', content: 'Tresc regulaminu pracowni komputerowej.', status: 'published', author: 'jkowalski' },
  { title: 'Instrukcja BHP', content: 'Podstawowe zasady bezpieczenstwa.', status: 'published', author: 'pwisniewski' },
  { title: 'Plan na kolejny semestr', content: 'Wstepny szkic planu.', status: 'draft', author: 'pwisniewski' },
];

const hash = (password) => argon2.hash(password, { type: argon2.argon2id, ...config.argon2 });

async function main() {
  const existing = db.prepare('SELECT 1 FROM users WHERE login = ?').get('ADMIN');
  if (existing) {
    console.log('Baza jest już zainicjalizowana. Użyj "npm run reset-db", aby utworzyć ją od nowa.');
    return;
  }

  const adminOtp = generateOneTimePassword();
  const accounts = [
    {
      login: 'ADMIN', fullName: 'Administrator systemu', role: 'Administrator',
      password: adminOtp, oneTime: true, isSystem: true,
    },
  ];
  for (const u of TEST_USERS) {
    accounts.push({ ...u, password: u.oneTime ? generateOneTimePassword() : u.password });
  }
  for (const a of accounts) a.hash = await hash(a.password);

  const expiresAt = otpExpiryDate().toISOString();

  const insertRole = db.prepare('INSERT INTO roles (name, description) VALUES (?, ?)');
  const insertPerm = db.prepare('INSERT INTO permissions (code, description) VALUES (?, ?)');
  const insertRolePerm = db.prepare(`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = ? AND p.code = ?`);
  const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
  const insertUser = db.prepare(`
    INSERT INTO users (login, full_name, password_hash, must_change_password, otp_expires_at, is_system)
    VALUES (@login, @fullName, @hash, @mustChange, @otpExpiresAt, @isSystem)`);
  const insertHistory = db.prepare('INSERT INTO password_history (user_id, password_hash) VALUES (?, ?)');
  const insertUserRole = db.prepare(`
    INSERT INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE name = ?`);
  const insertDoc = db.prepare(`
    INSERT INTO documents (title, content, status, author_id)
    SELECT ?, ?, ?, id FROM users WHERE login = ?`);

  db.transaction(() => {
    for (const r of ROLES) insertRole.run(r.name, r.description);
    for (const p of PERMISSIONS) insertPerm.run(p.code, p.description);
    for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
      for (const code of perms) insertRolePerm.run(role, code);
    }
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insertSetting.run(k, v);

    for (const a of accounts) {
      const { lastInsertRowid: userId } = insertUser.run({
        login: a.login,
        fullName: a.fullName,
        hash: a.hash,
        mustChange: a.oneTime ? 1 : 0,
        otpExpiresAt: a.oneTime ? expiresAt : null,
        isSystem: a.isSystem ? 1 : 0,
      });
      
      if (!a.oneTime) insertHistory.run(userId, a.hash);
      insertUserRole.run(userId, a.role);
    }

    for (const d of SAMPLE_DOCUMENTS) insertDoc.run(d.title, d.content, d.status, d.author);
  })();

  console.log('Baza zainicjalizowana.\n');
  console.table(accounts.map((a) => ({
    login: a.login,
    rola: a.role,
    haslo: a.password,
    jednorazowe: a.oneTime ? `tak (do ${expiresAt})` : 'nie',
  })));
  console.log('\nHasła jednorazowe są wyświetlane tylko teraz, w bazie zapisano wyłącznie ich hashe.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
