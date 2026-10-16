// npm run setting                            - lista ustawień
// npm run setting -- session_idle_minutes 1  - zmiana ustawienia
const { getAllSettings, setSetting } = require('../services/settings');

const [key, value] = process.argv.slice(2);

if (!key) {
  console.table(getAllSettings());
} else if (value === undefined) {
  console.log('Podaj wartość, np.: npm run setting -- session_idle_minutes 1');
} else if (setSetting(key, value)) {
  console.log(`${key} = ${value}`);
} else {
  console.log(`Nie ma ustawienia ${key}`);
}
