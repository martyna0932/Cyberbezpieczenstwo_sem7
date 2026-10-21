const { getNumber } = require('./settings');

function getPolicy() {
  return {
    minLength: getNumber('password_min_length', 15),
    maxLength: getNumber('password_max_length', 128),
    passphraseRule: getNumber('passphrase_rule_enabled', 0) === 1,
    minWords: getNumber('passphrase_min_words', 3),
  };
}

function countWords(password) {
  return password.split(/[ -]+/).filter((word) => word.length > 0).length;
}

function validatePassword(password, policy = getPolicy()) {
  const errors = [];
  const length = [...password].length;

  if (length < policy.minLength) {
    errors.push(`Hasło musi mieć co najmniej ${policy.minLength} znaków.`);
  }
  if (length > policy.maxLength) {
    errors.push(`Hasło może mieć najwyżej ${policy.maxLength} znaków.`);
  }
  if (policy.passphraseRule && countWords(password) < policy.minWords) {
    errors.push(`Hasło musi składać się z co najmniej ${policy.minWords} słów oddzielonych spacją lub myślnikiem.`);
  }
  return errors;
}

module.exports = { getPolicy, validatePassword, countWords };
