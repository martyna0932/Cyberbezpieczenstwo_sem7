const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');

const config = require('./config');
const db = require('./db');
const SqliteSessionStore = require('./db/sessionStore');
const sessionTimeout = require('./middleware/sessionTimeout');
const csrf = require('./middleware/csrf');
const { loadUser, requirePasswordChange } = require('./middleware/auth');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } },
}));

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

app.use(session({
  name: config.session.cookieName,
  secret: config.session.secret,
  store: new SqliteSessionStore(db),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.session.secure,
  },
}));

app.use(sessionTimeout);
app.use(csrf);
app.use(loadUser);
app.use(requirePasswordChange);

app.use((req, res, next) => {
  res.locals.flash = req.session.flash;
  delete req.session.flash;
  next();
});

app.use(require('./routes/auth'));
app.use(require('./routes/profile'));
app.use(require('./routes/twoFactor'));
app.use(require('./routes/admin'));
app.use(require('./routes/documents'));
app.use(require('./routes/home'));

app.use((req, res) => {
  res.status(404).render('error', { title: 'Nie znaleziono', status: 404, message: 'Nie ma takiej strony.' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { title: 'Błąd', status: 500, message: 'Wystąpił błąd serwera.' });
});

app.listen(config.port, () => {
  console.log(`Serwer działa: http://localhost:${config.port}`);
});
