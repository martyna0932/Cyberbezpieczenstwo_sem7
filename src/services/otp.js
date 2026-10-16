const crypto = require('crypto');

// Wariant 6: 12 znakow (litery, cyfry, znaki specjalne), wazne 48 h.
const OTP_LENGTH = 12;
const OTP_VALIDITY_HOURS = 48;

const GROUPS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  special: '!@#$%^&*-_=+?',
};
const ALL = Object.values(GROUPS).join('');

// Losowanie wylacznie przez CSPRNG (crypto.randomInt), nigdy Math.random.
function pick(alphabet) {
  return alphabet[crypto.randomInt(alphabet.length)];
}

// Tasowanie Fishera-Yatesa, rowniez z CSPRNG.
function shuffle(chars) {
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars;
}

// Gwarantuje co najmniej jeden znak z kazdej grupy, reszta losowana z calosci.
function generateOneTimePassword() {
  const chars = Object.values(GROUPS).map(pick);
  while (chars.length < OTP_LENGTH) chars.push(pick(ALL));
  return shuffle(chars).join('');
}

function otpExpiryDate(from = new Date()) {
  return new Date(from.getTime() + OTP_VALIDITY_HOURS * 60 * 60 * 1000);
}

module.exports = {
  OTP_LENGTH,
  OTP_VALIDITY_HOURS,
  generateOneTimePassword,
  otpExpiryDate,
};
