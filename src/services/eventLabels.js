const LOGIN_REASONS = {
  unknown_login: 'nieznany login',
  bad_password: 'błędne hasło',
  locked: 'próba logowania na zablokowane konto',
  locked_now: 'błędne hasło, konto zablokowane na 15 minut',
  blocked: 'konto zablokowane przez administratora',
  otp_expired: 'hasło jednorazowe wygasło',
  bad_totp: 'błędny kod TOTP',
};

const CAPTCHA_ERRORS = {
  'missing-input-response': 'brak tokenu CAPTCHA',
  'invalid-input-response': 'nieprawidłowy token CAPTCHA',
  'timeout-or-duplicate': 'token CAPTCHA wygasł lub został już użyty',
  'verification-unavailable': 'brak połączenia z Cloudflare',
  'missing-input-secret': 'brak klucza tajnego',
  'invalid-input-secret': 'nieprawidłowy klucz tajny',
  'bad-request': 'nieprawidłowe zapytanie',
  'internal-error': 'błąd serwera Cloudflare',
};

function captchaText(codes) {
  return codes.split(',').filter(Boolean).map((c) => CAPTCHA_ERRORS[c] || c).join(', ');
}

function describeDetails(type, details) {
  switch (type) {
    case 'login.success':
      return details === 'totp' ? 'hasło i kod TOTP' : 'hasło';
    case 'login.failure':
      return LOGIN_REASONS[details] || details || '';
    case 'captcha.failure':
      if (details && details.startsWith('change-password: ')) {
        return `zmiana hasła: ${captchaText(details.slice('change-password: '.length))}`;
      }
      return `logowanie: ${captchaText(details || '')}`;
    case 'bot.honeypot':
      return `wypełnione ukryte pole: ${details || ''}`;
    case 'honeytoken.triggered':
      return details === 'alert wysłany' ? 'próba logowania na konto-pułapkę, wysłano alert Canarytoken' : 'próba logowania na konto-pułapkę, brak adresu tokenu w .env';
    case 'access.denied':
      return details ? `odmowa dostępu: ${details}` : 'odmowa dostępu';
    default:
      return details || '';
  }
}

module.exports = { describeDetails };
