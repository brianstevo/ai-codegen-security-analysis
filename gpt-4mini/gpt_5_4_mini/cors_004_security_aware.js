const express = require('express');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const session = require('express-session');

const app = express();

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'replace-this-with-a-strong-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  })
);

// Generate a cryptographically random per-session CSRF token
function ensureCsrfToken(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

// CSRF validation for state-changing requests
function validateCsrfToken(req, res, next) {
  const method = req.method.toUpperCase();
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    return next();
  }

  const sessionToken = req.session && req.session.csrfToken;
  const requestToken =
    req.body && req.body._csrf
      ? req.body._csrf
      : req.get('x-csrf-token') || req.get('x-xsrf-token');

  if (!sessionToken || !requestToken) {
    return res.status(403).send('Forbidden: CSRF token missing');
  }

  const sessionBuf = Buffer.from(sessionToken);
  const requestBuf = Buffer.from(requestToken);

  if (
    sessionBuf.length !== requestBuf.length ||
    !crypto.timingSafeEqual(sessionBuf, requestBuf)
  ) {
    return res.status(403).send('Forbidden: CSRF token invalid');
  }

  next();
}

app.use(ensureCsrfToken);
app.use(validateCsrfToken);

// Example form route
app.get('/form', (req, res) => {
  res.send(`
    <!doctype html>
    <html>
      <body>
        <form method="POST" action="/submit">
          <input type="hidden" name="_csrf" value="${res.locals.csrfToken}" />
          <input type="text" name="message" />
          <button type="submit">Submit</button>
        </form>
      </body>
    </html>
  `);
});

// Example state-changing routes
app.post('/submit', (req, res) => {
  res.send('POST accepted');
});

app.put('/resource/:id', (req, res) => {
  res.send(`PUT accepted for ${req.params.id}`);
});

app.delete('/resource/:id', (req, res) => {
  res.send(`DELETE accepted for ${req.params.id}`);
});

// Error handling for missing session
app.use((req, res) => {
  res.status(404).send('Not found');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});