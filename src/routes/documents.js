const express = require('express');
const { requirePermission, forbidden } = require('../middleware/permissions');
const documents = require('../services/documents');
const { logEvent } = require('../services/eventLog');

const router = express.Router();

function readForm(body) {
  return {
    title: String(body.title || '').trim(),
    content: String(body.content || '').trim(),
  };
}

function log(req, type, doc) {
  logEvent({ userId: req.user.id, login: req.user.login, type, details: `dokument #${doc.id}`, ip: req.ip });
}

function loadDocument(req, res, next) {
  const doc = documents.findById(Number(req.params.id));
  if (!doc) {
    return res.status(404).render('error', { title: 'Nie znaleziono', status: 404, message: 'Nie ma takiego dokumentu.' });
  }
  req.doc = doc;
  next();
}

function requireView(req, res, next) {
  if (!documents.canView(req.user, req.doc)) return forbidden(req, res);
  next();
}

function requireEdit(req, res, next) {
  if (!documents.canEdit(req.user, req.doc)) return forbidden(req, res);
  next();
}

router.get('/documents', requirePermission('documents.read'), (req, res) => {
  res.render('documents/list', {
    title: 'Dokumenty',
    documents: documents.listFor(req.user),
    canEdit: (doc) => documents.canEdit(req.user, doc),
  });
});

router.get('/documents/new', requirePermission('documents.create'), (req, res) => {
  res.render('documents/form', { title: 'Nowy dokument', doc: null, form: { title: '', content: '' }, errors: [] });
});

router.post('/documents', requirePermission('documents.create'), (req, res) => {
  const form = readForm(req.body);
  const errors = documents.validate(form);
  if (errors.length > 0) {
    return res.status(400).render('documents/form', { title: 'Nowy dokument', doc: null, form, errors });
  }

  const id = documents.create(req.user.id, form);
  log(req, 'document.create', { id });
  req.session.flash = 'Dokument zapisany jako szkic.';
  res.redirect(`/documents/${id}`);
});

router.get('/documents/:id', requirePermission('documents.read'), loadDocument, requireView, (req, res) => {
  res.render('documents/show', {
    title: req.doc.title,
    doc: req.doc,
    canEdit: documents.canEdit(req.user, req.doc),
  });
});

router.get('/documents/:id/edit', requirePermission('documents.read'), loadDocument, requireEdit, (req, res) => {
  res.render('documents/form', { title: 'Edycja dokumentu', doc: req.doc, form: req.doc, errors: [] });
});

router.post('/documents/:id', requirePermission('documents.read'), loadDocument, requireEdit, (req, res) => {
  const form = readForm(req.body);
  const errors = documents.validate(form);
  if (errors.length > 0) {
    return res.status(400).render('documents/form', { title: 'Edycja dokumentu', doc: req.doc, form, errors });
  }

  documents.update(req.doc.id, form);
  log(req, 'document.update', req.doc);
  req.session.flash = 'Zapisano zmiany.';
  res.redirect(`/documents/${req.doc.id}`);
});

router.post('/documents/:id/publish', requirePermission('documents.publish'), loadDocument, (req, res) => {
  const publish = req.doc.status !== 'published';
  documents.setStatus(req.doc.id, publish ? 'published' : 'draft');
  log(req, publish ? 'document.publish' : 'document.unpublish', req.doc);
  req.session.flash = publish ? 'Dokument opublikowany.' : 'Dokument wycofany do szkiców.';
  res.redirect(`/documents/${req.doc.id}`);
});

router.get('/documents/:id/delete', requirePermission('documents.delete'), loadDocument, (req, res) => {
  res.render('documents/delete', { title: 'Usuwanie dokumentu', doc: req.doc });
});

router.post('/documents/:id/delete', requirePermission('documents.delete'), loadDocument, (req, res) => {
  documents.remove(req.doc.id);
  log(req, 'document.delete', req.doc);
  req.session.flash = `Usunięto dokument „${req.doc.title}”.`;
  res.redirect('/documents');
});

module.exports = router;
