const BASE_URL = (process.argv.find((a) => a.startsWith('--url=')) || '--url=http://localhost:3000').slice(6);
const BYPASS_CAPTCHA = process.argv.includes('--bypass-captcha');
const DUMMY_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';

const PASSWORDS = ['123456', 'password', 'qwerty123', 'admin123', 'Haslo123!', 'zaq12wsx', 'polska2024', 'letmein'];
const LOGINS = ['jkowalski', 'pwisniewski', 'tkaminski', 'klewandowska', 'mzielinski', 'anowak', 'mwojcik', 'admin', 'test', 'user'];

class Browser {
  constructor() {
    this.cookies = new Map();
  }

  cookieHeader() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  storeCookies(response) {
    for (const line of response.headers.getSetCookie()) {
      const [pair] = line.split(';');
      const i = pair.indexOf('=');
      this.cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
  }

  async request(path, options = {}) {
    const response = await fetch(BASE_URL + path, {
      ...options,
      redirect: 'manual',
      headers: { 'User-Agent': 'bot-test/1.0', Cookie: this.cookieHeader(), ...(options.headers || {}) },
    });
    this.storeCookies(response);
    const body = await response.text();
    return { status: response.status, location: response.headers.get('location'), body };
  }

  async csrfToken() {
    const { body } = await this.request('/login');
    const match = body.match(/name="_csrf" value="([0-9a-f]+)"/);
    return match ? match[1] : '';
  }
}

function classify({ status, location, body }) {
  if (status === 302 && location === '/') return 'brak - bot zalogowany';
  if (status === 302 && location === '/login/2fa') return 'TOTP (hasło odgadnięte)';
  if (status === 403) return 'CSRF';
  if (status === 429 && body.includes('adresu IP')) return 'limit prób z adresu IP';
  if (status === 429) return 'blokada konta';
  if (status === 400 && body.includes('Weryfikacja CAPTCHA')) return 'CAPTCHA (Turnstile)';
  if (status === 400 && body.includes('Nie udało się przetworzyć formularza')) return 'pole-pułapka';
  if (status === 401) return 'błędne dane logowania';
  return `nieznana odpowiedź (${status})`;
}

const results = [];

async function attempt(scenario, { login, password, captcha = 'none', honeypot = '', csrf = true }) {
  const browser = new Browser();
  const token = csrf ? await browser.csrfToken() : '';
  const form = new URLSearchParams({ _csrf: token, login, password, website: honeypot });
  if (captcha === 'dummy') form.set('cf-turnstile-response', DUMMY_TOKEN);
  if (captcha === 'fake') form.set('cf-turnstile-response', 'sfalszowany-token-' + Date.now());

  const response = await browser.request('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  let stoppedBy = classify(response);
  if (login === 'backup_admin' && response.status === 401) stoppedBy = 'konto-pułapka (alert Canarytoken)';
  results.push({ scenariusz: scenario, login, 'status HTTP': response.status, 'zatrzymane przez': stoppedBy });
  return stoppedBy;
}

async function main() {
  const captcha = BYPASS_CAPTCHA ? 'dummy' : 'none';
  console.log(`Cel: ${BASE_URL}`);
  console.log(BYPASS_CAPTCHA
    ? `Tryb: bot wysyła testowy token CAPTCHA (${DUMMY_TOKEN})\n`
    : 'Tryb: bot nie potrafi rozwiązać CAPTCHA\n');

  await attempt('1. Żądanie bez tokenu CSRF', { login: 'jkowalski', password: 'admin123', csrf: false });
  await attempt('2. Brak tokenu CAPTCHA', { login: 'jkowalski', password: 'admin123' });
  await attempt('3. Sfałszowany token CAPTCHA', { login: 'jkowalski', password: 'admin123', captcha: 'fake' });
  await attempt('4. Wypełnione pole-pułapka', { login: 'jkowalski', password: 'admin123', captcha, honeypot: 'http://spam.example' });
  await attempt('5. Konto-pułapka (Canarytoken)', { login: 'backup_admin', password: 'backup123', captcha });

  for (const password of PASSWORDS.slice(0, 6)) {
    await attempt('6. Brute force na jedno konto', { login: 'pwisniewski', password, captcha });
  }

  for (let i = 0; i < 20; i++) {
    const stoppedBy = await attempt('7. Password spraying', { login: LOGINS[i % LOGINS.length], password: 'Haslo123!', captcha });
    if (stoppedBy === 'limit prób z adresu IP') break;
  }

  console.table(results);

  const summary = {};
  for (const r of results) summary[r['zatrzymane przez']] = (summary[r['zatrzymane przez']] || 0) + 1;
  console.log('\nZestawienie - liczba prób zatrzymanych przez każde zabezpieczenie:');
  console.table(Object.entries(summary).map(([k, v]) => ({ zabezpieczenie: k, 'liczba prób': v })));

  const logged = results.filter((r) => r['zatrzymane przez'].startsWith('brak'));
  console.log(logged.length === 0
    ? `\nWynik: żadna z ${results.length} prób bota nie zakończyła się zalogowaniem.`
    : `\nUWAGA: bot zalogował się ${logged.length} razy.`);
  if (results.some((r) => r['zatrzymane przez'].startsWith('konto-pułapka'))) {
    console.log('Próba na konto backup_admin wygląda dla bota jak zwykły błąd logowania, ale aplikacja wysłała alert Canarytoken.');
  }
}

main().catch((err) => {
  console.error('Błąd połączenia z aplikacją:', err.message);
  process.exit(1);
});
