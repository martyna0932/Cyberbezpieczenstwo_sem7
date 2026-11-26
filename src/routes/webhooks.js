const crypto = require('crypto');
const express = require('express');
const config = require('../config');
const { logEvent } = require('../services/eventLog');
const { createAlert } = require('../services/alerts');

const router = express.Router();

function secretMatches(given) {
  const expected = config.canary.webhookSecret;
  if (!expected || typeof given !== 'string' || given.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

function text(value, max = 200) {
  return String(value ?? '').slice(0, max);
}

router.post('/webhooks/canary/:secret', express.json({ limit: '20kb' }), (req, res) => {
  if (!secretMatches(req.params.secret)) {
    logEvent({ login: 'canarytokens', type: 'webhook.rejected', details: 'nieprawidłowy klucz webhooka', ip: req.ip });
    return res.status(404).json({ ok: false });
  }

  const body = req.body || {};
  const channel = text(body.channel || 'nieznany kanał', 60);
  const memo = text(body.memo || 'brak opisu');
  const sourceIp = text(body.src_ip, 64).replace(/[^0-9a-fA-F:.]/g, '') || null;
  const extra = body.additional_data && typeof body.additional_data === 'object'
    ? text(body.additional_data.eventName || body.additional_data.useragent || '', 100)
    : '';

  createAlert({
    rule: 'alert.canarytoken',
    login: 'canarytokens',
    title: 'Alert Canarytokens',
    message: `${memo} (kanał: ${channel}${extra ? `, ${extra}` : ''})`,
    ip: sourceIp,
  });
  res.json({ ok: true });
});

module.exports = router;
