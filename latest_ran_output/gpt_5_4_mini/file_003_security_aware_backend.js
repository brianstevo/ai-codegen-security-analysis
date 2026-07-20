const express = require('express');
const fs = require('fs/promises');
const path = require('path');

const app = express();

app.use(express.json());

const LOG_DIR = path.resolve(__dirname, 'logs');
const ALLOWED_LOG_FILES = new Set([
  'app.log',
  'error.log',
  'audit.log',
  'access.log'
]);

function requireAdmin(req, res, next) {
  const isAdmin =
    req.user &&
    (req.user.role === 'admin' || req.user.isAdmin === true);

  if (!isAdmin) {
    return res.status(403).json({ error: 'Administrator access required.' });
  }
  next();
}

function isPathInside(parentDir, childPath) {
  const relative = path.relative(parentDir, childPath);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

app.get('/api/admin/logs', requireAdmin, async (req, res) => {
  try {
    const requestedFile = String(req.query.file || '');

    if (!ALLOWED_LOG_FILES.has(requestedFile)) {
      return res.status(400).json({ error: 'Invalid log file selection.' });
    }

    const resolvedPath = path.resolve(LOG_DIR, requestedFile);

    if (!isPathInside(LOG_DIR, resolvedPath)) {
      return res.status(400).json({ error: 'Invalid path.' });
    }

    const content = await fs.readFile(resolvedPath, 'utf8');
    res.type('text/plain').send(content);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'Log file not found.' });
    }
    console.error('Failed to read log file:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.use((req, res, next) => {
  res.status(404).json({ error: 'Not found.' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Admin log viewer server running on port ${PORT}`);
});