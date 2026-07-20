```javascript
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const router = express.Router();

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * Applies strict no-cache headers to prevent sensitive data from being stored
 * in browser caches, proxy caches, or CDN layers.
 */
function noCacheHeaders(req, res, next) {
  // Prevent storage in any cache (browser, proxy, CDN)
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');

  // Legacy HTTP/1.0 backward compatibility for proxies
  res.setHeader('Pragma', 'no-cache');

  // Expires in the past forces caches to treat content as stale immediately
  res.setHeader('Expires', '0');

  // Surrogate-Control is specifically for CDN/reverse proxy layers (e.g. Varnish, Fastly)
  // It takes precedence over Cache-Control for CDNs that support it
  res.setHeader('Surrogate-Control', 'no-store');

  // Vary header to prevent cached responses being served to different users
  res.setHeader('Vary', 'Authorization, Cookie');

  next();
}

/**
 * Verifies JWT token from the Authorization header.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access denied. No token provided.',
    });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('JWT_SECRET environment variable is not set.');
    return res.status(500).json({
      success: false,
      error: 'Internal server configuration error.',
    });
  }

  jwt.verify(token, secret, { algorithms: ['HS256'] }, (err, decoded) => {
    if (err) {
      const message =
        err.name === 'TokenExpiredError'
          ? 'Token has expired.'
          : 'Invalid token.';
      return res.status(403).json({ success: false, error: message });
    }
    req.user = decoded;
    next();
  });
}

/**
 * Ensures the authenticated user can only access their own account details
 * unless they have an admin role.
 */
function authorizeAccountAccess(req, res, next) {
  const requestedUserId = req.params.userId;
  const tokenUserId = String(req.user.userId || req.user.sub);
  const userRole = req.user.role;

  if (userRole !== 'admin' && tokenUserId !== requestedUserId) {
    return res.status(403).json({
      success: false,
      error: 'Access denied. You can only view your own account details.',
    });
  }

  next();
}

// ─── Mock Data Layer ──────────────────────────────────────────────────────────

/**
 * Simulates fetching a user record from a database.
 * Replace this with your actual database query.
 */
async function getUserFromDatabase(userId) {
  // Simulated DB records — replace with real DB calls (e.g., pg, mongoose, etc.)
  const mockUsers = {
    '101': {
      id: '101',
      username: 'alice',
      email: 'alice@example.com',
      passwordHash: await bcrypt.hash('secret123', 12),
      role: 'user',
      fullName: 'Alice Johnson',
      phoneNumber: '+1-555-123-4567',
      dateOfBirth: '1990-04-15',
      address: {
        street: '123 Maple Street',
        city: 'Springfield',
        state: 'IL',
        postalCode: '62701',
        country: 'US',
      },
      paymentMethods: [
        {
          type: 'credit_card',
          last4: '4242',
          brand: 'Visa',
          expiryMonth: 12,
          expiryYear: 2026,
        },
      ],
      twoFactorEnabled: true,
      createdAt: '2022-01-10T08:30:00Z',
      lastLogin: '2024-11-01T14:22:10Z',
      accountStatus: 'active',
      kycVerified: true,
    },
    '202': {
      id: '202',
      username: 'bob',
      email: 'bob@example.com',
      passwordHash: await bcrypt.hash('password456', 12),
      role: 'admin',
      fullName: 'Bob Martinez',
      phoneNumber: '+1-555-987-6543',
      dateOfBirth: '1985-09-22',
      address: {
        street: '456 Oak Avenue',
        city: 'Shelbyville',
        state: 'IL',
        postalCode: '62565',
        country: 'US',
      },
      paymentMethods: [],
      twoFactorEnabled: false,
      createdAt: '2021-06-01T09:00:00Z',
      lastLogin: '2024-11-03T11:05:55Z',
      accountStatus: 'active',
      kycVerified: false,
    },
  };

  return mockUsers[userId] || null;
}

/**
 * Sanitizes a user record before sending it in the response.
 * Removes internal secrets (e.g., password hashes) that must never be exposed.
 */
function sanitizeUserRecord(user) {
  const {
    passwordHash,  // Never expose password hashes
    __v,           // MongoDB version key (if applicable)
    ...safeFields
  } = user;

  return safeFields;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/accounts/:userId
 *
 * Returns sensitive account details for the specified user.
 * Protected by JWT authentication and account-level authorization.
 * All cache headers are set to prevent any caching of sensitive data.
 */
router.get(
  '/accounts/:userId',
  noCacheHeaders,          // Step 1: Set no-cache headers immediately
  authenticateToken,       // Step 2: Verify JWT
  authorizeAccountAccess,  // Step 3: Check authorization
  async (req, res) => {
    try {
      const { userId } = req.params;

      // Basic input validation to prevent unexpected DB queries
      if (!userId || !/^\d+$/.test(userId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid user ID format.',
        });
      }

      const user = await getUserFromDatabase(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'Account not found.',
        });
      }

      const sanitizedUser = sanitizeUserRecord(user);

      return res.status(200).json({
        success: true,
        data: {
          account: sanitizedUser,
        },
        meta: {
          retrievedAt: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || null,
        },
      });
    } catch (error) {
      console.error('Error fetching account details:', error);
      return res.status(500).json({
        success: false,
        error: 'An unexpected error occurred while retrieving account details.',
      });
    }
  }
);

/**
 * GET /api/accounts/:userId/payment-methods
 *
 * Returns payment method details — especially sensitive.
 * Same cache-prevention policy applies.
 */
router.get(
  '/accounts/:userId/payment-methods',
  noCacheHeaders,
  authenticateToken,