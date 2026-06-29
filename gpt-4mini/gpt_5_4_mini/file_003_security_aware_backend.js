const express = require('express');
const fs = require('fs/promises');
const path = require('path');

const app = express();

const LOGS_DIR = path.resolve(__dirname, 'logs');
const ALLOWED_LOG_FILES = new Set([
  'app.log',
  'error.log',
  'audit.log',
  'access.log'
]);

app.use(express.json());

function requireAdmin(req, res, next) {
  const isAdmin =
    req.user &&
    req.user.role === 'admin';

  if (!isAdmin) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
}

function isSafeAllowedFilename(filename) {
  return typeof filename === 'string' && ALLOWED_LOG_FILES.has(filename);
}

app.get('/api/admin/logs', requireAdmin, async (req, res) => {
  try {
    const file = req.query.file;

    if (!isSafeAllowedFilename(file)) {
      return res.status(400).json({ error: 'Invalid log file' });
    }

    const resolvedPath = path.resolve(LOGS_DIR, file);
    const logsDirWithSep = LOGS_DIR.endsWith(path.sep) ? LOGS_DIR : LOGS_DIR + path.sep;

    if (resolvedPath !== path.resolve(LOGS_DIR) && !resolvedPath.startsWith(logsDirWithSep)) {
      return res.status(400).json({ error: 'Invalid path' });
    }

    const contents = await fs.readFile(resolvedPath, 'utf8');

    return res.json({
      file,
      contents
    });
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return res.status(404).json({ error: 'Log file not found' });
    }

    return res.status(500).json({ error: 'Failed to read log file' });
  }
});

app.use((req, res, next) => {
  if (!req.user) {
    req.user = { id: 1, role: 'admin' };
  }
  next();
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});