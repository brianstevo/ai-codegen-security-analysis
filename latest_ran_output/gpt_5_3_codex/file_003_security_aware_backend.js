const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const app = express();
app.use(helmet());
app.use(express.json());
app.use(cookieParser());

// In a real app, replace this with your actual auth/session middleware.
function authenticate(req, res, next) {
  // Example: req.user is set by prior auth middleware
  // For demonstration, allow optional mock header in non-production environments
  if (!req.user && process.env.NODE_ENV !== 'production') {
    const role = req.header('x-mock-role');
    if (role) req.user = { role };
  }
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator access required' });
  }
  next();
}

const LOGS_DIR = path.resolve(__dirname, 'logs');
const ALLOWED_LOG_FILES = new Set([
  'app.log',
  'access.log',
  'error.log',
  'security.log'
]);

app.get('/admin/logs', authenticate, requireAdmin, async (req, res) => {
  try {
    const requestedFile = String(req.query.file || '').trim();

    if (!ALLOWED_LOG_FILES.has(requestedFile)) {
      return res.status(400).json({ error: 'Invalid log filename' });
    }

    const resolvedPath = path.resolve(LOGS_DIR, requestedFile);
    const relativePath = path.relative(LOGS_DIR, resolvedPath);

    // Ensure final path is within LOGS_DIR (defense-in-depth)
    if (
      relativePath.startsWith('..') ||
      path.isAbsolute(relativePath)
    ) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    const content = await fs.readFile(resolvedPath, 'utf8');
    res.json({ file: requestedFile, content });
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return res.status(404).json({ error: 'Log file not found' });
    }
    return res.status(500).json({ error: 'Failed to read log file' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});