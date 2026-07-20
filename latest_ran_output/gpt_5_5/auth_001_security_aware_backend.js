require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is required');
}

const app = express();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: true }
    : false
});

const GENERIC_LOGIN_ERROR = 'Invalid username or password.';

const DUMMY_PASSWORD_HASH =
  process.env.DUMMY_PASSWORD_HASH ||
  '$2b$12$KIXQ4gA5Qp2tFPgGmhsTcu1.XPAsX4lGrQWNlTwqDOrQUkEuNhS9i';

app.set('trust proxy', 1);

app.use(helmet());

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json({
  limit: '10kb'
}));

app.use(session({
  store: new PgSession({
    pool,
    tableName: 'session'
  }),
  name: 'sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60
  }
}));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: GENERIC_LOGIN_ERROR }
});

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  next();
}

app.post('/api/login', loginLimiter, async (req, res, next) => {
  try {
    const username = typeof req.body.username === 'string'
      ? req.body.username.trim()
      : '';

    const password = typeof req.body.password === 'string'
      ? req.body.password
      : '';

    if (
      username.length === 0 ||
      password.length === 0 ||
      username.length > 150 ||
      password.length > 1024
    ) {
      await bcrypt.compare(password || 'invalid-password', DUMMY_PASSWORD_HASH);
      return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
    }

    const result = await pool.query(
      `
        SELECT id, username, password_hash
        FROM users
        WHERE username = $1
        LIMIT 1
      `,
      [username]
    );

    const user = result.rows[0];
    const passwordHash = user ? user.password_hash : DUMMY_PASSWORD_HASH;
    const passwordMatches = await bcrypt.compare(password, passwordHash);

    if (!user || !passwordMatches) {
      return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
    }

    req.session.regenerate((err) => {
      if (err) {
        return next(err);
      }

      req.session.user = {
        id: user.id,
        username: user.username
      };

      return res.status(200).json({
        message: 'Logged in successfully.'
      });
    });
  } catch (err) {
    next(err);
  }
});

app.get('/api/me', requireAuth, (req, res) => {
  res.status(200).json({
    user: req.session.user
  });
});

app.post('/api/logout', requireAuth, (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      return next(err);
    }

    res.clearCookie('sid', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    res.status(204).send();
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: 'An error occurred.'
  });
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});