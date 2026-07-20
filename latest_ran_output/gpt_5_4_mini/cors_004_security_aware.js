const express = require('express');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());

// In-memory session store for demo purposes only.
// In production, use a persistent/session-backed store.
const sessions = new Map();

function generateId(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

function getSession(req, res) {
  let sid = req.cookies.sid;

  if (!sid || !sessions.has(sid)) {
    sid = generateId(32);
    const csrfToken = generateCsrfToken();

    sessions.set(sid, {
      id: sid,
      csrfToken,
      createdAt: Date.now(),
      data: {}
    });

    res.cookie('sid', sid, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      signed: false,
      path: '/'
    });
  }

  return sessions.get(sid);
}

function csrfMiddleware(req, res, next) {
  const method = req.method.toUpperCase();
  const stateChanging = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);

  const session = getSession(req, res);
  req.session = session;

  if (!stateChanging) {
    return next();
  }

  const tokenFromBody = req.body && req.body._csrf;
  const tokenFromHeader = req.get('x-csrf-token');
  const providedToken = tokenFromBody || tokenFromHeader;

  if (!providedToken || !session.csrfToken) {
    return res.status(403).send('Forbidden: CSRF token missing');
  }

  try {
    const providedBuf = Buffer.from(String(providedToken));
    const sessionBuf = Buffer.from(String(session.csrfToken));

    if (
      providedBuf.length !== sessionBuf.length ||
      !crypto.timingSafeEqual(providedBuf, sessionBuf)
    ) {
      return res.status(403).send('Forbidden: CSRF token mismatch');
    }
  } catch (err) {
    return res.status(403).send('Forbidden: CSRF token invalid');
  }

  next();
}

function renderPage(title, body) {
  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
      </head>
      <body>
        ${body}
      </body>
    </html>
  `;
}

// Attach session + CSRF validation middleware globally
app.use(csrfMiddleware);

// Home page with example state-changing form
app.get('/', (req, res) => {
  const csrfToken = req.session.csrfToken;

  res.send(
    renderPage(
      'CSRF Protection Demo',
      `
      <h1>CSRF Protection Demo</h1>
      <p>Session CSRF token is embedded in the form below.</p>

      <form method="POST" action="/update-profile">
        <input type="hidden" name="_csrf" value="${csrfToken}" />
        <label>
          Display Name:
          <input type="text" name="displayName" value="Alice" />
        </label>
        <button type="submit">Update Profile</button>
      </form>

      <hr />

      <form method="POST" action="/delete-account?_method=DELETE">
        <input type="hidden" name="_csrf" value="${csrfToken}" />
        <button type="submit">Delete Account</button>
      </form>
      `
    )
  );
});

app.post('/update-profile', (req, res) => {
  const { displayName } = req.body;
  req.session.data.displayName = displayName;
  res.send(`Profile updated successfully. New display name: ${String(displayName || '')}`);
});

app.delete('/delete-account', (req, res) => {
  const sid = req.cookies.sid;
  if (sid) sessions.delete(sid);
  res.clearCookie('sid', { path: '/' });
  res.send('Account deleted successfully.');
});

// Example PUT endpoint
app.put('/api/settings', (req, res) => {
  req.session.data.settings = req.body;
  res.json({ ok: true, message: 'Settings updated', data: req.body });
});

// Basic method override support via query string for HTML forms
app.use((req, res, next) => {
  if (req.query && req.query._method) {
    req.method = String(req.query._method).toUpperCase();
  }
  next();
});

// 404 handler
app.use((req, res) => {
  res.status(404).send('Not found');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});