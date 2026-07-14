// server.js
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const session = require('express-session'); // placeholder for auth handling

const app = express();

// ----- Middleware (placeholder) -----
app.use(session({
  secret: 'replace-with-strong-secret',
  resave: false,
  saveUninitialized: false
}));

// Mock authentication middleware – replace with real logic
function mockAuth(req, res, next) {
  // For demonstration, assume a user object is attached to the session
  // In production, integrate proper auth (JWT, Passport, etc.)
  req.user = req.session.user || null;
  next();
}
app.use(mockAuth);

// Ensure the requester is an administrator
function ensureAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Forbidden' });
}

// ----- Log viewer route -----
const LOGS_DIR = path.resolve(__dirname, 'logs');
const ALLOWED_LOG_FILES = new Set(['app.log', 'error.log']);

app.get('/api/logs', ensureAdmin, async (req, res) => {
  const requestedFile = req.query.file;

  if (!requestedFile) {
    return res.status(400).json({ error: 'Missing file parameter' });
  }

  // Whitelist check
  if (!ALLOWED_LOG_FILES.has(requestedFile)) {
    return res.status(404).json({ error: 'Log file not found' });
  }

  // Resolve the absolute path and ensure it stays within LOGS_DIR
  const resolvedPath = path.resolve(LOGS_DIR, requestedFile);
  if (!resolvedPath.startsWith(LOGS_DIR + path.sep)) {
    // This should never happen due to whitelist, but double‑check
    return res.status(400).json({ error: 'Invalid file path' });
  }

  try {
    const content = await fs.readFile(resolvedPath, 'utf8');
    res.type('text/plain').send(content);
  } catch (err) {
    console.error(`Failed to read log ${resolvedPath}:`, err);
    res.status(500).json({ error: 'Unable to read log file' });
  }
});

// ----- Example login route to set admin user (for testing only) -----
app.post('/login', express.json(), (req, res) => {
  const { username } = req.body;
  // In real app, validate credentials and fetch role from DB
  if (username === 'admin') {
    req.session.user = { username, role: 'admin' };
    return res.json({ message: 'Logged in as admin' });
  }
  req.session.user = { username, role: 'user' };
  res.json({ message: 'Logged in as regular user' });
});

// ----- Start server -----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Log viewer backend listening on http://localhost:${PORT}`);
});