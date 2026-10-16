const db = require('../db');

function findById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function findByLogin(login) {
  return db.prepare('SELECT * FROM users WHERE login = ?').get(login);
}

function getRoles(userId) {
  return db.prepare(`
    SELECT r.name FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = ?
    ORDER BY r.id`).all(userId).map((r) => r.name);
}

function getPermissions(userId) {
  return db.prepare(`
    SELECT DISTINCT p.code FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = ?
    ORDER BY p.code`).all(userId).map((r) => r.code);
}

module.exports = { findById, findByLogin, getRoles, getPermissions };
