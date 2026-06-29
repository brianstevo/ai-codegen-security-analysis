```javascript
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// ─── In-memory "database" (replace with real DB in production) ───────────────
const users = [
  {
    id: 1,
    username: 'alice',
    // bcrypt hash of "password123"
    passwordHash: '$2b$12$KIXBp9R9Ew3z6pFz1234567890abcdefghijklmnopqrstuvwxyz12',
    email: 'alice@example.com',
    phone: '+1-555-867-5309',
    ssn: '***-**-6789',
    creditCard: '**** **** **** 4242',
    balance: 15432.67,
    accountNumber: 'ACC-000123456',
    role: 'user',
  },
];

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-production';
const TOKEN_EXPIRY = '15m'; // Short-lived tokens for sensitive data

// ─── Middleware: Set no-cache headers for ALL responses on this router ────────
router.use((req, res, next) => {
  // Prevent browser and intermediate proxy caches from storing the response
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  // HTTP/1.0 backward compatibility
  res.setHeader('Pragma', 'no-cache');
  // Tell CDN layers (Fastly, Varnish, etc.) not to store the response
  res.setHeader('Surrogate-Control', 'no-store');
  // Prevent cached responses from being reused after expiry
  res.setHeader('Expires', '0');
  next();
});

// ─── Middleware: Authenticate JWT ─────────────────────────────────────────────
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Access token is required.',
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'TokenExpired',
          message: 'Access token has expired. Please log in again.',
        });
      }
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid access token.',
      });
    }
    req.user = decoded;
    next();
  });
}

// ─── Middleware: Authorise user to access only their own account ──────────────
function authoriseAccountAccess(req, res, next) {
  const requestedId = parseInt(req.params.userId, 10);

  if (isNaN(requestedId)) {
    return res.status(400).json({
      error: 'BadRequest',
      message: 'Invalid user ID.',
    });
  }

  // Allow admins to access any account; regular users only their own
  if (req.user.role !== 'admin' && req.user.id !== requestedId) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You are not authorised to access this account.',
    });
  }

  next();
}

// ─── POST /auth/login ─────────────────────────────────────────────────────────
router.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      error: 'BadRequest',
      message: 'Username and password are required.',
    });
  }

  const user = users.find((u) => u.username === username);

  // Use constant-time comparison via bcrypt to resist timing attacks
  const passwordValid = user
    ? await bcrypt.compare(password, user.passwordHash)
    : await bcrypt.compare(password, '$2b$12$invalidhashfortimingnormalization'); // dummy compare

  if (!user || !passwordValid) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid username or password.',
    });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );

  return res.status(200).json({
    message: 'Login successful.',
    token,
    expiresIn: TOKEN_EXPIRY,
  });
});

// ─── GET /accounts/:userId ────────────────────────────────────────────────────
// Returns sensitive account details; cache-prevention headers already applied.
router.get(
  '/accounts/:userId',
  authenticateToken,
  authoriseAccountAccess,
  (req, res) => {
    const requestedId = parseInt(req.params.userId, 10);
    const user = users.find((u) => u.id === requestedId);

    if (!user) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Account not found.',
      });
    }

    // Return sensitive fields — never return passwordHash
    const { passwordHash, ...sensitiveDetails } = user;

    return res.status(200).json({
      meta: {
        timestamp: new Date().toISOString(),
        requestedBy: req.user.username,
        cachePolicy: 'no-store',
      },
      account: sensitiveDetails,
    });
  }
);

// ─── GET /accounts/:userId/transactions ───────────────────────────────────────
// Additional sensitive endpoint: recent transactions
router.get(
  '/accounts/:userId/transactions',
  authenticateToken,
  authoriseAccountAccess,
  (req, res) => {
    const requestedId = parseInt(req.params.userId, 10);
    const user = users.find((u) => u.id === requestedId);

    if (!user) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Account not found.',
      });
    }

    // Simulated transactions (replace with DB query in production)
    const transactions = [
      { id: 'TXN-001', date: '2024-06-01', description: 'Direct Deposit', amount: +2500.00, balance: 15432.67 },
      { id: 'TXN-002', date: '2024-05-30', description: 'Grocery Store', amount: -87.43, balance: 12932.67 },
      { id: 'TXN-003', date: '2024-05-28', description: 'Utility Bill',  amount: -142.00, balance: 13020.10 },
    ];

    return res.status(200).json({
      meta: {
        timestamp: new Date().toISOString(),
        accountId: requestedId,
        count: transactions.length,
      },
      transactions,
    });
  }
);

// ─── Express app wiring ───────────────────────────────────────────────────────
const app = express();
app.use(express.json());

// Mount the sensitive-data router under /api/v1
app.use('/api/v1', router);

// Global error handler
app.use((err, req, res, _next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: 'InternalServerError', message: 'An unexpected error occurred.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${