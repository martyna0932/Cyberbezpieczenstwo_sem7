# Modul 1 - identyfikacja, uwierzytelnianie i autoryzacja

Wariant 6: minimalna dlugosc hasla 15, regula frazy haslowej (min. 3 slowa),
role Administrator / Kierownik / Redaktor / Czytelnik, haslo jednorazowe
12 znakow wazne 48 h.

## Technologia

- Node.js + Express, widoki EJS
- SQLite (`better-sqlite3`)
- Hashowanie hasel: Argon2id (`argon2`)

## Uruchomienie

```bash
npm install
npm run seed      # tworzy baze, konto ADMIN i 7 uzytkownikow testowych
npm start         # http://localhost:3000
```

`npm run reset-db` usuwa baze i tworzy ja od nowa.

Seed wypisuje w konsoli hasla kont. Haslo jednorazowe konta ADMIN jest losowane
przy kazdym seedzie i widoczne tylko w tym momencie.
