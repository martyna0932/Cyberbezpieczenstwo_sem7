const path = require('path');
const express = require('express');
const config = require('./config');
const db = require('./db');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.disable('x-powered-by');

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM users').get();
  res.render('index', { title: 'Start', userCount: count });
});

app.use((req, res) => {
  res.status(404).render('error', { title: 'Nie znaleziono', status: 404, message: 'Nie ma takiej strony.' });
});

app.listen(config.port, () => {
  console.log(`Aplikacja dziala na http://localhost:${config.port}`);
});
