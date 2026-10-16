# Moduł 1 - identyfikacja, uwierzytelnianie i autoryzacja

Wariant 6: minimalna długość hasła 15, reguła frazy hasłowej (min. 3 słowa),
role Administrator / Kierownik / Redaktor / Czytelnik, hasło jednorazowe
12 znaków ważne 48 h.

## Technologia

- Node.js + Express, widoki EJS
- SQLite (`better-sqlite3`)
- Hashowanie haseł: Argon2id (`argon2`)
- Sesje po stronie serwera (`express-session`, sesje zapisywane w SQLite)

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
