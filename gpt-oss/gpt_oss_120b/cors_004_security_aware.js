// csrf-protected-app.js
const express = require('express');
const session = require('express-session');
const crypto = require('crypto');

const app = express();

// ---------- Session Setup ----------
app.use(
  session({
    secret: 'replace-with-strong-secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // set to true in prod
      sameSite: 'lax',
    },
  })
);

// ---------- Body Parsers ----------
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// ---------- CSRF Token Generation Middleware ----------
function generateCsrfToken(req, res, next) {
  if (!req.session.csrfToken) {
    // 32‑byte (256‑bit) random token, hex encoded
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  // expose to templates / downstream handlers
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

// ---------- CSRF Validation Middleware ----------
function validateCsrf(req, res, next) {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) return next();

  // token can be sent via body field "_csrf" or custom header
  const tokenFromBody = req.body && req.body._csrf;
  const tokenFromHeader =
    req.get('x-csrf-token') || req.get('xsrf-token') || req.get('csrf-token');

  const suppliedToken = tokenFromBody || tokenFromHeader;

  if (!suppliedToken) {
    return res.status(403).send('CSRF token missing');
  }

  if (req.session.csrfToken !== suppliedToken) {
    return res.status(403).send('Invalid CSRF token');
  }

  next();
}

// ---------- Apply Middlewares ----------
app.use(generateCsrfToken);
app.use(validateCsrf);

// ---------- Example Routes ----------
app.get('/', (req, res) => {
  // Simple page with a state‑changing form
  const html = `
    <h1>CSRF Demo</h1>
    <form method="POST" action="/submit">
      <input type="hidden" name="_csrf" value="${res.locals.csrfToken}">
      <label>Message: <input name="msg"></label>
      <button type="submit">Send</button>
    </form>
  `;
  res.send(html);
});

app.post('/submit', (req, res) => {
  // At this point CSRF token has been validated
  const { msg } = req.body;
  res.send(`Message received: ${msg}`);
});

// ---------- Start Server ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`CSRF‑protected app listening on http://localhost:${PORT}`);
});