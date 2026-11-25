const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');

const GENESIS = '0'.repeat(32);
const SEP = ' | ';
const HASH_FIELD = `${SEP}md5=`;

let lastHash = null;

function md5(text) {
  return crypto.createHash('md5').update(text, 'utf8').digest('hex');
}

function clean(value, max = 300) {
  const text = String(value ?? '')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/\|/g, '/')
    .trim()
    .slice(0, max);
  return text || '-';
}

function readLines() {
  if (!fs.existsSync(config.securityLogPath)) return [];
  return fs.readFileSync(config.securityLogPath, 'utf8')
    .split('\n')
    .map((line) => line.replace(/\r$/, ''))
    .filter((line) => line.trim() !== '');
}

function parseLine(line, number) {
  const cut = line.lastIndexOf(HASH_FIELD);
  const content = cut === -1 ? line : line.slice(0, cut);
  const parts = content.split(SEP);
  const entry = {
    line: number,
    raw: line,
    content,
    hash: cut === -1 ? '' : line.slice(cut + HASH_FIELD.length).trim(),
    time: parts[0],
  };
  for (const part of parts.slice(1)) {
    const i = part.indexOf('=');
    if (i > 0) entry[part.slice(0, i)] = part.slice(i + 1);
  }
  return entry;
}

function readEntries() {
  return readLines().map((line, i) => parseLine(line, i + 1));
}

function previousHash() {
  if (lastHash === null) {
    const lines = readLines();
    lastHash = lines.length ? parseLine(lines[lines.length - 1]).hash || GENESIS : GENESIS;
  }
  return lastHash;
}

function append({ user, ip, action, result, desc }) {
  const content = [
    new Date().toISOString(),
    `user=${clean(user, 64)}`,
    `ip=${clean(ip, 64)}`,
    `action=${clean(action, 64)}`,
    `result=${result}`,
    `desc=${clean(desc)}`,
  ].join(SEP);
  const hash = md5(content + previousHash());
  fs.mkdirSync(path.dirname(config.securityLogPath), { recursive: true });
  fs.appendFileSync(config.securityLogPath, `${content}${HASH_FIELD}${hash}\n`, 'utf8');
  lastHash = hash;
}

module.exports = { GENESIS, md5, clean, append, readEntries };
