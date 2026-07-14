// app.js
const express = require('express');
const session = require('express-session');
const crypto = require('crypto');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();

// ---------- Configuration ----------
app.set('view engine', 'ejs'); // or any templating engine you prefer
app.set('views', path.join(__dirname, 'views'));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Session middleware (store should be replaced with a persistent store in prod)
app.use(
  session({
    secret: crypto.randomBytes(64).toString('hex'),
    resave: false,
    saveUninitialized: true,
    cookie: { httpOnly: true, sameSite: 'lax' },
  })
);

// ---------- CSRF Token Generation ----------
function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Ensure a token exists for the session and expose it to views
app.use((req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCsrfToken();
  }
  // Make token available in templates as `csrfToken`
  res.locals.csrfToken = req.session.csrfToken;
  next();
});

// ---------- CSRF Validation Middleware ----------
function csrfProtection(req, res, next) {
  const method = req.method.toUpperCase();
  const stateChangingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!stateChangingMethods.includes(method)) return next();

  // Token can be sent via body field `_csrf` or header `x-csrf-token`
  const tokenFromBody = req.body && req.body._csrf;
  const tokenFromHeader = req.get('x-csrf-token');
  const submittedToken = tokenFromBody || tokenFromHeader;

  if (!submittedToken) {
    return res.status(403).send('CSRF token missing');
  }

  if (submittedToken !== req.session.csrfToken) {
    return res.status(403).send('Invalid CSRF token');
  }

  // Token is valid – proceed
  next();
}

// Apply CSRF protection globally for state‑changing routes
app.use(csrfProtection);

// ---------- Example Routes ----------
app.get('/', (req, res) => {
  // Render a simple form that includes the hidden CSRF field
  res.render('index'); // views/index.ejs will use `csrfToken`
});

app.post('/submit', (req, res) => {
  // If we reach here, CSRF token was valid
  const { name } = req.body;
  res.send(`Form submitted successfully. Hello, ${name}!`);
});

// Example of a DELETE endpoint using JSON body or header token
app.delete('/resource/:id', (req, res) => {
  const { id } = req.params;
  // Perform deletion logic...
  res.json({ message: `Resource ${id} deleted.` });
});

// ---------- Error handling ----------
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Internal Server Error');
});

// ---------- Start server ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

/*
Directory structure:
.
├─ app.js
└─ views/
   └─ index.ejs

// views/index.ejs
<!DOCTYPE html>
<html>
<head><title>CSRF Demo</title></head>
<body>
  <h1>Submit Form</h1>
  <form action="/submit" method="POST">
    <input type="hidden" name="_csrf" value="<%= csrfToken %>" />
    <label>Name: <input type="text" name="name" required /></label><br/>
    <button type="submit">Send</button>
  </form>

  <!-- Example of AJAX request with token in header -->
  <script>
    async function deleteResource(id) {
      const response = await fetch(`/resource/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': '<%= csrfToken %>'
        }
      });
      const data = await response.json();
      console.log(data);
    }
  </script>
</body>
</html>
*/