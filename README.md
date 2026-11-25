# Moduł 1 - identyfikacja, uwierzytelnianie i autoryzacja

Wariant 6: minimalna długość hasła 15, reguła frazy hasłowej (min. 3 słowa),
role Administrator / Kierownik / Redaktor / Czytelnik, hasło jednorazowe
12 znaków ważne 48 h.

## Technologia

- Node.js + Express, widoki EJS
- SQLite (`better-sqlite3`)
- Hashowanie haseł: Argon2id (`argon2`)
- Sesje po stronie serwera (`express-session`, sesje zapisywane w SQLite)
- Weryfikacja dwuetapowa TOTP (`otplib`, kod QR: `qrcode`)
- CAPTCHA: Cloudflare Turnstile (logowanie i zmiana hasła)
- Ukryte pole-pułapka (honeypot) w formularzu logowania
- Canarytokens: konto-pułapka `backup_admin` (alert przy każdej próbie logowania)
- Dziennik zdarzeń w panelu administratora (`/admin/events`)
- Limit nieudanych prób logowania z jednego adresu IP (blokada na 15 minut)
- Dziennik zdarzeń bezpieczeństwa w pliku tekstowym `data/security.log` z łańcuchem MD5

## Uruchomienie

```bash
npm install
npm run seed      # tworzy bazę, konto ADMIN i 7 użytkowników testowych
npm start         # http://localhost:3000
```

Inne komendy:

- `npm run reset-db` - usuwa bazę i tworzy ją od nowa
- `npm run dev` - serwer z automatycznym restartem po zmianach w kodzie
- `npm run setting` - lista ustawień
- `npm run setting -- session_idle_minutes 1` - zmiana ustawienia (np. czasu bezczynności)

Seed wypisuje w konsoli hasła kont. Hasło jednorazowe konta ADMIN jest losowane
przy każdym seedzie i widoczne tylko w tym momencie.

## Cloudflare Turnstile

Bez konfiguracji aplikacja używa kluczy testowych Cloudflare (CAPTCHA zawsze przechodzi).
Aby użyć własnych kluczy, skopiuj `.env.example` jako `.env` i wpisz klucze z panelu
Cloudflare (Turnstile → Add widget, hostname `localhost`):

```
TURNSTILE_SITE_KEY=...
TURNSTILE_SECRET_KEY=...
```

## Canarytokens

Konto-pułapka `backup_admin` powstaje przy `npm run seed`. Do istniejącej bazy można je dodać
poleceniem `npm run honeypot`. Na to konto nie da się zalogować, a każda próba zapisuje zdarzenie
`honeytoken.triggered` i wywołuje adres tokenu Web bug z canarytokens.org podany w `.env`:

```
CANARY_HONEYPOT_URL=...
```

## Limit prób z jednego adresu IP

Nieudane próby logowania są liczone dla adresu IP niezależnie od konta. Limit ustawia administrator
(Ustawienia, domyślnie 20 prób w ciągu 15 minut). Zablokowane adresy można odblokować w panelu
albo poleceniem `npm run unblock-ip` (wszystkie) lub `npm run unblock-ip -- ::1` (jeden adres).

## Test bota

Skrypt `scripts/bot-test.js` symuluje bota, który próbuje zalogować się do działającej aplikacji
(brak CSRF, brak i sfałszowany token CAPTCHA, pole-pułapka, konto-pułapka, brute force, password spraying)
i wypisuje, które zabezpieczenie zatrzymało każdą próbę.

```
npm run bot
```

Z opcją `--bypass-captcha` bot wysyła testowy token Cloudflare. Przechodzi on weryfikację tylko wtedy,
gdy serwer działa na testowym kluczu tajnym, co pozwala sprawdzić zabezpieczenia stojące za CAPTCHA:

```
set TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
npm start
npm run bot -- --bypass-captcha
```

## Dziennik zdarzeń bezpieczeństwa (moduł 3, wariant 6)

Zdarzenia bezpieczeństwa są zapisywane w pliku `data/security.log`, po jednym wpisie w linii:

```
2026-11-17T10:23:45.123Z | user=ADMIN | ip=::1 | action=login.success | result=SUKCES | desc=hasło i kod TOTP | md5=...
```

Czas jest zapisywany w UTC. Na końcu linii znajduje się skrót MD5 obliczony z treści wpisu i skrótu
poprzedniego wpisu (łańcuch), co pozwala wykryć zmianę lub usunięcie wpisu. Dane od użytkownika są
oczyszczane ze znaków nowej linii i separatora `|`, a hasła ani tokeny nie trafiają do dziennika.

Rejestrowane zdarzenia: logowanie (`login.success`), wylogowanie (`logout`, `session.timeout`),
nieudane logowanie (`login.failure`), blokada konta (`account.locked`), zmiana hasła
(`password.change`, `password.change_failed`), tworzenie, edycja, blokowanie i usuwanie użytkowników
(`user.create`, `user.update`, `user.block`, `user.unblock`, `user.delete`), zmiana roli
(`user.role_change`), zmiana ustawień (`settings.update`), odmowa dostępu (`access.denied`), użycie
konta-pułapki (`honeytoken.triggered`) oraz zdarzenia CAPTCHA, pola-pułapki, limitu IP i TOTP.
