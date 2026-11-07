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
