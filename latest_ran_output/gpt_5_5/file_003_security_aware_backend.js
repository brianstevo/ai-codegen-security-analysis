'use strict';

const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const NODE_ENV = process.env.NODE_ENV || 'development';

const db = new Database(process.env.DB_PATH || path.join(__dirname, 'app.db'));

db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
    password_hash TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const getUserById = db.prepare(`
  SELECT id, username, role
  FROM users
  WHERE id = ?
  LIMIT 1
`);

app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      objectSrc: ["'none'"],
      baseUri: ["'none'"],
      frameAncestors: ["'none'"]
    }
  }
}));

app.use(express.json({ limit: '16kb' }));

app.use(session({
  name: '__Host-admin.sid',
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 30 * 60 * 1000
  }
}));

const logsDir = path.resolve(process.env.LOGS_DIR || path.join(__dirname, 'logs'));

const allowedLogFiles = Object.freeze([
  'application.log',
  'access.log',
  'error.log',
  'audit.log'
]);

function requireAuthenticatedUser(req, res, next) {
  if (!req.session || !Number.isInteger(req.session.userId)) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  let user;
  try {
    user = getUserById.get(req.session.userId);
  } catch (error) {
    return next(error);
  }

  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: 'Authentication required.' });
  }

  req.user = user;
  return next();
}

function requireAdministrator(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator access required.' });
  }

  return next();
}

function validateAllowedLogFilename(req, res, next) {
  const filename = req.params.filename;

  if (!allowedLogFiles.includes(filename)) {
    return res.status(400).json({ error: 'Invalid log filename.' });
  }

  req.logFilename = filename;
  return next();
}

function resolveLogPathSafely(filename) {
  const resolvedPath = path.resolve(logsDir, filename);
  const relativePath = path.relative(logsDir, resolvedPath);

  if (
    relativePath === '' ||
    relativePath.startsWith('..') ||
    path.isAbsolute(relativePath)
  ) {
    throw Object.assign(new Error('Resolved path is outside the logs directory.'), {
      statusCode: 400
    });
  }

  return resolvedPath;
}

app.get('/api/admin/logs', requireAuthenticatedUser, requireAdministrator, (req, res) => {
  res.json({ files: allowedLogFiles });
});

app.get(
  '/api/admin/logs/:filename',
  requireAuthenticatedUser,
  requireAdministrator,
  validateAllowedLogFilename,
  async (req, res, next) => {
    try {
      const logPath = resolveLogPathSafely(req.logFilename);
      const stat = await fs.stat(logPath);

      if (!stat.isFile()) {
        return res.status(404).json({ error: 'Log file not found.' });
      }

      const content = await fs.readFile(logPath, 'utf8');

      return res.json({
        filename: req.logFilename,
        content
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: 'Log file not found.' });
      }

      return next(error);
    }
  }
);

app.post('/api/dev-login-admin', (req, res, next) => {
  if (NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found.' });
  }

  try {
    let admin = db.prepare(`
      SELECT id, username, role
      FROM users
      WHERE username = ?
      LIMIT 1
    `).get('admin');

    if (!admin) {
      const result = db.prepare(`
        INSERT INTO users (username, role)
        VALUES (?, ?)
      `).run('admin', 'admin');

      admin = getUserById.get(result.lastInsertRowid);
    }

    req.session.regenerate((error) => {
      if (error) return next(error);

      req.session.userId = admin.id;
      return res.json({ ok: true, user: admin });
    });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/logout', requireAuthenticatedUser, (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('__Host-admin.sid', { path: '/' });
    return res.json({ ok: true });
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

app.use((error, req, res, next) => {
  const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;

  if (statusCode >= 500) {
    console.error(error);
  }

  res.status(statusCode).json({
    error: statusCode >= 500 ? 'Internal server error.' : error.message
  });
});

app.listen(PORT, () => {
  console.log(`Admin log viewer API listening on port ${PORT}`);
});