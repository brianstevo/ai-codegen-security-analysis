```javascript
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const router = express.Router();

// Mock user database
const users = [
  {
    id: 1,
    username: 'testuser',
    // Hashed version of 'password123'
    passwordHash: '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  },
];

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const ALLOWED_HOSTS = process.env.ALLOWED_HOSTS
  ? process.env.ALLOWED_HOSTS.split(',')
  : ['localhost:3000', 'example.com'];

/**
 * Validates that a redirect URL is safe to use.
 * Prevents open redirect vulnerabilities by:
 * 1. Only allowing relative URLs
 * 2. Or allowing absolute URLs only to whitelisted hosts
 */
function isValidRedirectUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }

  // Allow relative URLs that start with '/' but not '//'
  // '//' could be used as a protocol-relative URL pointing to an external host
  if (url.startsWith('/') && !url.startsWith('//')) {
    return true;
  }

  // For absolute URLs, check against the whitelist
  try {
    const parsedUrl = new URL(url);
    const host = parsedUrl.host;
    return ALLOWED_HOSTS.includes(host);
  } catch {
    // If URL parsing fails, it's not a valid URL
    return false;
  }
}

/**
 * Sanitizes the redirect URL, returning a safe default if invalid.
 */
function sanitizeRedirectUrl(url, defaultUrl = '/dashboard') {
  return isValidRedirectUrl(url) ? url : defaultUrl;
}

/**
 * Middleware to check if the user is already authenticated.
 * If authenticated, redirect to the intended URL or dashboard.
 */
function checkAlreadyAuthenticated(req, res, next) {
  const token = req.cookies?.authToken || req.headers.authorization?.split(' ')[1];

  if (token) {
    try {
      jwt.verify(token, JWT_SECRET);
      const redirectUrl = sanitizeRedirectUrl(req.query.redirect);
      return res.redirect(302, redirectUrl);
    } catch {
      // Token is invalid or expired, continue to login
    }
  }

  next();
}

/**
 * Middleware to verify JWT for protected routes.
 */
function authenticateToken(req, res, next) {
  const token = req.cookies?.authToken || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

/**
 * GET /login
 * Renders the login page (or returns login form info).
 * Preserves the redirect query parameter.
 */
router.get('/login', checkAlreadyAuthenticated, (req, res) => {
  const redirectUrl = req.query.redirect || '';
  const sanitizedRedirect = isValidRedirectUrl(redirectUrl) ? redirectUrl : '';

  // In a real app, you'd render an HTML template here.
  // For this example, we return JSON with the redirect info.
  res.json({
    message: 'Please log in',
    loginEndpoint: 'POST /login',
    redirectAfterLogin: sanitizedRedirect || '/dashboard',
    fields: ['username', 'password'],
  });
});

/**
 * POST /login
 * Authenticates the user and redirects to the provided URL or default dashboard.
 *
 * Query Parameters:
 *   - redirect (optional): URL to redirect to after successful login.
 *
 * Request Body:
 *   - username: The user's username.
 *   - password: The user's password.
 *
 * Responses:
 *   - 302: Redirect to the target URL on success.
 *   - 400: Missing credentials.
 *   - 401: Invalid credentials.
 *   - 500: Server error.
 */
router.post('/login', checkAlreadyAuthenticated, async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({
        error: 'Username and password are required',
      });
    }

    if (typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        error: 'Invalid input types',
      });
    }

    // Enforce length limits to prevent DoS attacks
    if (username.length > 100 || password.length > 200) {
      return res.status(400).json({
        error: 'Input exceeds maximum allowed length',
      });
    }

    // Find user in the database
    const user = users.find((u) => u.username === username.trim());

    // Use a timing-safe comparison to prevent timing attacks
    // Even if user is not found, we still run bcrypt to prevent user enumeration
    const dummyHash = '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';
    const hashToCompare = user ? user.passwordHash : dummyHash;
    const isPasswordValid = await bcrypt.compare(password, hashToCompare);

    if (!user || !isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid username or password',
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
      },
      JWT_SECRET,
      {
        expiresIn: '1h',
        issuer: 'your-app-name',
        audience: 'your-app-users',
      }
    );

    // Set the token as an HTTP-only cookie
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600000, // 1 hour in milliseconds
    });

    // Sanitize and validate the redirect URL
    const requestedRedirect = req.query.redirect || req.body.redirect || '';
    const redirectUrl = sanitizeRedirectUrl(requestedRedirect);

    // Log successful login (in production, use a proper logger)
    console.log(`User "${user.username}" logged in. Redirecting to: ${redirectUrl}`);

    // Redirect to the target URL
    return res.redirect(302, redirectUrl);
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      error: 'An internal server error occurred',
    });
  }
});

/**
 * POST /logout
 * Logs the user out by clearing the auth cookie.
 */
router.post('/logout', (req, res) => {
  res.clearCookie('authToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });

  res.json({ message: 'Logged out successfully' });
});

/**
 * GET /dashboard
 * A protected route example that users are redirected to after login.
 */
router.get('/dashboard', authenticateToken, (req, res) => {
  res.json({
    message: `Welcome to your dashboard, ${req.user.username}!`,
    user: {
      id: