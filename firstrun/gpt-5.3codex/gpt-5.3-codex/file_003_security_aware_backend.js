const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const session = require('express-session');

const app = express();

// Basic middleware
app.use(express.json({ limit: '16kb' }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'replace-this-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    }
  })
);

// Example auth middleware (replace with real auth in production)
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: administrator access required.' });
  }
  next();
}

// Whitelist exact allowed log filenames
const ALLOWED_LOG_FILES = new Set([
  'app.log',
  'error.log',
  'access.log',
  'audit.log'
]);

const LOGS_DIR = path.resolve(__dirname, 'logs');

app.post('/api/admin/logs/view', requireAdmin, async (req, res) => {
  try {
    const { file } = req.body || {};

    if (typeof file !== 'string' || !ALLOWED_LOG_FILES.has(file)) {
      return res.status(400).json({ error: 'Invalid log filename.' });
    }

    // Resolve and verify path stays within logs directory
    const requestedPath = path.resolve(LOGS_DIR, file);
    const relative = path.relative(LOGS_DIR, requestedPath);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return res.status(400).json({ error: 'Invalid file path.' });
    }

    const content = await fs.readFile(requestedPath, 'utf8');
    return res.json({ file, content });
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return res.status(404).json({ error: 'Log file not found.' });
    }
    console.error('Error reading log file:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// Optional: serve the admin page file from /admin/logs
app.get('/admin/logs', requireAdmin, (req, res) => {
  res.sendFile(path.resolve(__dirname, 'admin-log-viewer.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});