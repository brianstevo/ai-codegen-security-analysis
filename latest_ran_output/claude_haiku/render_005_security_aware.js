```javascript
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json());

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const TRUSTED_DOMAINS = [
  'localhost:3000',
  'localhost:5000',
  'example.com',
  'www.example.com',
  'app.example.com'
];

// Mock user database
const users = [
  { id: 1, username: 'testuser', passwordHash: '$2b$10$YourHashedPasswordHere' }
];

/**
 * Validates if a redirect URL is safe
 * - Allows relative paths (starting with /)
 * - Allows absolute URLs only for whitelisted domains
 * - Rejects open redirect attacks
 */
function isValidRedirectUrl(url) {
  if (!url) {
    return false;
  }

  // Remove any whitespace
  const trimmedUrl = url.trim();

  // Allow relative paths starting with /
  if (trimmedUrl.startsWith('/')) {
    // Prevent protocol-based attacks like /\/\/example.com
    if (trimmedUrl.match(/^\/+[a-zA-Z]/)) {
      return false;
    }
    return true;
  }

  // Parse absolute URLs
  try {
    const parsedUrl = new URL(trimmedUrl);
    const host = parsedUrl.hostname;
    const port = parsedUrl.port ? `:${parsedUrl.port}` : '';
    const fullHost = port ? `${host}${port}` : host;

    // Check if the host is in the whitelist
    return TRUSTED_DOMAINS.some(domain => {
      // Exact match or subdomain match
      return fullHost === domain || fullHost.endsWith(`.${domain}`);
    });
  } catch (error) {
    // Invalid URL format
    return false;
  }
}

/**
 * POST /login
 * Handles user login and redirects to returnTo parameter if valid
 */
app.post('/login', async (req, res) => {
  try {
    const { username, password, returnTo } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user (in production, query database)
    const user = users.find(u => u.username === username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password (using mock hash for demo)
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create JWT token
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, {
      expiresIn: '1h'
    });

    // Set secure HTTP-only cookie
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 3600000 // 1 hour
    });

    // Validate and process returnTo parameter
    let redirectUrl = '/dashboard'; // Default redirect

    if (returnTo) {
      if (isValidRedirectUrl(returnTo)) {
        redirectUrl = returnTo;
      } else {
        // Log potential attack for security monitoring
        console.warn(`Potential open redirect attempt detected: ${returnTo}`);
        // Continue with default redirect instead of rejecting
      }
    }

    // Send response with redirect information
    return res.json({
      success: true,
      message: 'Login successful',
      token,
      redirect: redirectUrl
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /logout
 * Clears the authentication token
 */
app.get('/logout', (req, res) => {
  res.clearCookie('authToken');
  res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * POST /login-with-redirect
 * Alternative endpoint that performs server-side redirect
 */
app.post('/login-with-redirect', async (req, res) => {
  try {
    const { username, password, returnTo } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user
    const user = users.find(u => u.username === username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create JWT token
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, {
      expiresIn: '1h'
    });

    // Set secure HTTP-only cookie
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 3600000
    });

    // Validate and process returnTo parameter
    let redirectUrl = '/dashboard';

    if (returnTo && isValidRedirectUrl(returnTo)) {
      redirectUrl = returnTo;
    } else if (returnTo) {
      console.warn(`Potential open redirect attempt detected: ${returnTo}`);
    }

    // Perform server-side redirect
    return res.redirect(redirectUrl);
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /validate-redirect
 * Utility endpoint to validate a redirect URL without logging in
 * Useful for testing and debugging
 */
app.get('/validate-redirect', (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  const isValid = isValidRedirectUrl(url);

  return res.json({
    url,
    isValid,
    message: isValid ? 'Redirect URL is safe' : 'Redirect URL is not allowed'
  });
});

/**
 * Protected middleware to verify JWT token
 */
function authMiddleware(req, res, next) {
  const token = req.cookies.authToken || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * GET /dashboard
 * Protected route example
 */
app.get('/dashboard', authMiddleware, (req, res) => {
  res.json({
    message: 'Welcome to dashboard',
    user: req.user
  });
});

/**
 * GET /profile
 * Protected route example
 */
app.get('/profile', authMiddleware, (req, res) => {
  res.json({
    message: 'User profile',
    user: req.user
  });
});

/**
 * GET /settings
 * Protected route example
 */
app.get('/settings', authMiddleware, (req, res) => {
  res.json({
    message: 'User settings',
    user: req.user
  });
});