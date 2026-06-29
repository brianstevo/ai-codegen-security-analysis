const express = require("express");
const session = require("express-session");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use(
  session({
    name: "sid",
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60,
    },
  })
);

app.use((req, res, next) => {
  if (req.body && req.body._method) {
    const method = String(req.body._method).toUpperCase();

    if (["PUT", "DELETE"].includes(method)) {
      req.method = method;
    }
  }

  next();
});

function generateCsrfToken() {
  return crypto.randomBytes(32).toString("hex");
}

function safeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }

  const aBuffer = Buffer.from(a, "utf8");
  const bBuffer = Buffer.from(b, "utf8");

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

app.use((req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCsrfToken();
  }

  res.locals.csrfToken = req.session.csrfToken;
  next();
});

app.use((req, res, next) => {
  const stateChangingMethods = ["POST", "PUT", "DELETE"];

  if (!stateChangingMethods.includes(req.method)) {
    return next();
  }

  const submittedToken =
    req.body?._csrf ||
    req.headers["x-csrf-token"] ||
    req.headers["csrf-token"];

  if (!submittedToken || !safeCompare(submittedToken, req.session.csrfToken)) {
    return res.status(403).send("Forbidden: invalid or missing CSRF token");
  }

  next();
});

function csrfField(req) {
  return `<input type="hidden" name="_csrf" value="${req.session.csrfToken}">`;
}

app.get("/", (req, res) => {
  res.send(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>CSRF Protection Example</title>
      </head>
      <body>
        <h1>CSRF Protection Example</h1>

        <h2>Create Item</h2>
        <form method="POST" action="/items">
          ${csrfField(req)}
          <label>
            Name:
            <input type="text" name="name" required>
          </label>
          <button type="submit">Create</button>
        </form>

        <h2>Update Item</h2>
        <form method="POST" action="/items/1">
          ${csrfField(req)}
          <input type="hidden" name="_method" value="PUT">
          <label>
            New Name:
            <input type="text" name="name" required>
          </label>
          <button type="submit">Update</button>
        </form>

        <h2>Delete Item</h2>
        <form method="POST" action="/items/1">
          ${csrfField(req)}
          <input type="hidden" name="_method" value="DELETE">
          <button type="submit">Delete</button>
        </form>
      </body>
    </html>
  `);
});

app.post("/items", (req, res) => {
  res.send(`Created item: ${req.body.name}`);
});

app.put("/items/:id", (req, res) => {
  res.send(`Updated item ${req.params.id}: ${req.body.name}`);
});

app.delete("/items/:id", (req, res) => {
  res.send(`Deleted item ${req.params.id}`);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});