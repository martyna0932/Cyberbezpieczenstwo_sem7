const db = require('../db');

const has = (user, code) => user.permissions.includes(code);

function canView(user, doc) {
  if (doc.status === 'published') return has(user, 'documents.read');
  if (has(user, 'documents.edit_any')) return true;
  return doc.author_id === user.id && has(user, 'documents.edit_own');
}

function canEdit(user, doc) {
  if (has(user, 'documents.edit_any')) return true;
  return doc.author_id === user.id && has(user, 'documents.edit_own');
}

function listFor(user) {
  const docs = db.prepare(`
    SELECT d.*, u.full_name AS author_name
    FROM documents d
    LEFT JOIN users u ON u.id = d.author_id
    ORDER BY d.updated_at DESC, d.id DESC`).all();
  return docs.filter((doc) => canView(user, doc));
}

function findById(id) {
  return db.prepare(`
    SELECT d.*, u.full_name AS author_name
    FROM documents d
    LEFT JOIN users u ON u.id = d.author_id
    WHERE d.id = ?`).get(id);
}

function validate({ title, content }) {
  const errors = [];
  if (title.length < 1 || title.length > 200) errors.push('Tytuł jest wymagany (maks. 200 znaków).');
  if (content.length < 1 || content.length > 10000) errors.push('Treść jest wymagana (maks. 10 000 znaków).');
  return errors;
}

function create(authorId, { title, content }) {
  return db.prepare(
    "INSERT INTO documents (title, content, status, author_id) VALUES (?, ?, 'draft', ?)"
  ).run(title, content, authorId).lastInsertRowid;
}

function update(id, { title, content }) {
  db.prepare("UPDATE documents SET title = ?, content = ?, updated_at = datetime('now') WHERE id = ?")
    .run(title, content, id);
}

function setStatus(id, status) {
  db.prepare("UPDATE documents SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
}

function remove(id) {
  db.prepare('DELETE FROM documents WHERE id = ?').run(id);
}

module.exports = { canView, canEdit, listFor, findById, validate, create, update, setStatus, remove };
