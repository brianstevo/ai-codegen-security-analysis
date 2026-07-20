const express = require("express");
const session = require("express-session");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  session({
    name: "sid",
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
    resave: false,
    saveUninitialized: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  })
);

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

function generateCsrfToken() {
  return crypto.randomBytes(32).toString("hex");
}

function safeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;

  const aBuffer = Buffer.from(a, "utf8");
  const bBuffer = Buffer.from(b, "utf8");

  if (aBuffer.length !== bBuffer.length) return false;

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
  const methodOverride = req.body && req.body._method;

  if (
    req.method === "POST" &&
    typeof methodOverride === "string" &&
    ["PUT", "DELETE"].includes(methodOverride.toUpperCase())
  ) {
    req.method = methodOverride.toUpperCase();
  }

  next();
});

app.use((req, res, next) => {
  const stateChangingMethods = new Set(["POST", "PUT", "DELETE"]);

  if (!stateChangingMethods.has(req.method)) {
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function csrfField(req) {
  return `<input type="hidden" name="_csrf" value="${escapeHtml(req.session.csrfToken)}">`;
}

function methodField(method) {
  const upper = method.toUpperCase();
  if (upper === "POST") return "";
  return `<input type="hidden" name="_method" value="${escapeHtml(upper)}">`;
}

let items = [
  { id: 1, name: "Example item" },
];

let nextId = 2;

app.get("/", (req, res) => {
  const itemList = items
    .map(
      (item) => `
        <li>
          ${escapeHtml(item.name)}

          <form method="POST" action="/items/${item.id}" style="display:inline">
            ${csrfField(req)}
            ${methodField("PUT")}
            <input type="text" name="name" value="${escapeHtml(item.name)}" required>
            <button type="submit">Update</button>
          </form>

          <form method="POST" action="/items/${item.id}" style="display:inline">
            ${csrfField(req)}
            ${methodField("DELETE")}
            <button type="submit">Delete</button>
          </form>
        </li>
      `
    )
    .join("");

  res.send(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>CSRF Protected Forms</title>
      </head>
      <body>
        <h1>CSRF Protected Forms</h1>

        <h2>Create item</h2>
        <form method="POST" action="/items">
          ${csrfField(req)}
          <input type="text" name="name" required>
          <button type="submit">Create</button>
        </form>

        <h2>Items</h2>
        <ul>
          ${itemList}
        </ul>
      </body>
    </html>
  `);
});

app.post("/items", (req, res) => {
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";

  if (!name) {
    return res.status(400).send("Name is required");
  }

  items.push({ id: nextId++, name });
  res.redirect("/");
});

app.put("/items/:id", (req, res) => {
  const id = Number(req.params.id);
  const item = items.find((entry) => entry.id === id);
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";

  if (!item) {
    return res.status(404).send("Item not found");
  }

  if (!name) {
    return res.status(400).send("Name is required");
  }

  item.name = name;
  res.redirect("/");
});

app.delete("/items/:id", (req, res) => {
  const id = Number(req.params.id);
  items = items.filter((entry) => entry.id !== id);
  res.redirect("/");
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});