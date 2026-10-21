const crypto = require('crypto');

const OTP_LENGTH = 12;
const OTP_VALIDITY_HOURS = 48;

const GROUPS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  special: '!@#$%^&*-_=+?',
};
const ALL = Object.values(GROUPS).join('');

function pick(alphabet) {
  return alphabet[crypto.randomInt(alphabet.length)];
}

function shuffle(chars) {
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars;
}

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
