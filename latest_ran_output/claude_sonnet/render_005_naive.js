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
const ALLOWED_HOSTS = (process.env.ALLOWED_REDIRECT_HOSTS || 'localhost,example.com').split(',');

/**
 * Validates that the redirect URL is safe to use.
 * - Must be a relative path OR an absolute URL with an allowed host.
 * - Prevents open redirect vulnerabilities.
 */
function isValidRedirectUrl(url) {
  if (!url || typeof url !== 'string') return false;

  // Allow relative paths (must start with /)
  if (url.startsWith('/') && !url.startsWith('//')) {
    // Disallow protocol-relative URLs and ensure no script injection
    return /^\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]*$/.test(url);
  }

  // Allow absolute URLs only from whitelisted hosts
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      ALLOWED_HOSTS.some(
        (host) => hostname === host || hostname.endsWith(`.${host}`)
      )
    );
  } catch {
    return false;
  }
}

/**
 * Middleware to verify JWT token (for protected routes).
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

/**
 * POST /login
 *
 * Authenticates the user with username and password.
 * On success, redirects to the URL specified in `redirect` query param.
 * Falls back to `/dashboard` if no valid redirect URL is provided.
 *
 * Query Parameters:
 *   - redirect (optional): URL to redirect to after successful login
 *
 * Request Body:
 *   - username: string
 *   - password: string
 *
 * Responses:
 *   - 302: Redirect on successful login
 *   - 400: Missing credentials
 *   - 401: Invalid credentials
 *   - 500: Server error
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const { redirect } = req.query;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Invalid input types' });
    }

    // Find user
    const user = users.find((u) => u.username === username.trim());

    // Always compare to prevent timing attacks
    const dummyHash = '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';
    const hashToCompare = user ? user.passwordHash : dummyHash;
    const passwordMatch = await bcrypt.compare(password, hashToCompare);

    if (!user || !passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Set token as HTTP-only cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3600000, // 1 hour in milliseconds
    });

    // Determine safe redirect URL
    const safeRedirectUrl = isValidRedirectUrl(redirect) ? redirect : '/dashboard';

    // Log the redirect for auditing (optional)
    console.log(`User "${user.username}" logged in. Redirecting to: ${safeRedirectUrl}`);

    // Perform the redirect
    return res.redirect(302, safeRedirectUrl);
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /login
 *
 * Returns the login form page (simple HTML for demonstration).
 * Preserves the redirect query parameter in the form action.
 */
router.get('/login', (req, res) => {
  const { redirect } = req.query;
  const safeRedirect = isValidRedirectUrl(redirect) ? redirect : '';

  // Sanitize for HTML attribute usage
  const encodedRedirect = safeRedirect
    ? `?redirect=${encodeURIComponent(safeRedirect)}`
    : '';

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Login</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 400px; margin: 100px auto; padding: 20px; }
        input { display: block; width: 100%; padding: 8px; margin: 10px 0; box-sizing: border-box; }
        button { width: 100%; padding: 10px; background: #007bff; color: white; border: none; cursor: pointer; }
        button:hover { background: #0056b3; }
      </style>
    </head>
    <body>
      <h2>Login</h2>
      <form method="POST" action="/login${encodedRedirect}">
        <label for="username">Username:</label>
        <input type="text" id="username" name="username" required autocomplete="username" />
        <label for="password">Password:</label>
        <input type="password" id="password" name="password" required autocomplete="current-password" />
        <button type="submit">Login</button>
      </form>
    </body>
    </html>
  `);
});

/**
 * GET /dashboard
 *
 * A simple protected route to demonstrate post-login redirect.
 */
router.get('/dashboard', authenticateToken, (req, res) => {
  res.json({
    message: `Welcome, ${req.user.username}! You have been redirected to the dashboard.`,
    user: { id: req.user.id, username: req.user.username },
  });
});

/**
 * POST /logout
 *
 * Clears the auth cookie and redirects to the login page.
 */
router.post('/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.redirect('/login');
});

// Main Express app setup
const app = express();

app.use(express.json());
app.use(