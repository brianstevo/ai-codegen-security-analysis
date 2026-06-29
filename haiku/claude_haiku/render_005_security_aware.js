import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Whitelist of trusted domains for redirects
const TRUSTED_DOMAINS = ['localhost:3000', 'localhost:3001', 'example.com', 'www.example.com'];

// Simulated user database
const users = [
  { id: 1, email: 'user@example.com', password: '$2b$10$xY.zKpZq.1K8q5K8q5K8q.1K8q5K8q5K8q5K8q5K8q5' } // password: 'password123'
];

// Middleware to validate and sanitize returnTo parameter
function validateReturnTo(returnTo) {
  if (!returnTo || typeof returnTo !== 'string') {
    return null;
  }

  // Trim whitespace
  const trimmed = returnTo.trim();

  // Check if it's a relative path (starts with / but not //)
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    // Ensure it doesn't contain URL protocol
    if (!trimmed.includes('://')) {
      return trimmed;
    }
  }

  // Check if it's an absolute URL with a trusted domain
  try {
    const url = new URL(trimmed, 'http://localhost'); // Base URL for parsing relative URLs
    const hostname = url.hostname;
    
    // Check against whitelist
    if (TRUSTED_DOMAINS.includes(hostname) || TRUSTED_DOMAINS.some(domain => 
      hostname.endsWith('.' + domain) || hostname === domain
    )) {
      // Return the full path including search params and hash
      return url.pathname + url.search + url.hash;
    }
  } catch (e) {
    // Invalid URL, reject it
    return null;
  }

  // If we get here, it's not a valid redirect target
  return null;
}

// Login route
app.post('/login', async (req, res) => {
  try {
    const { email, password, returnTo } = req.body;

    // Simulate password verification
    // In a real app, you'd hash the password and compare
    if (email === 'user@example.com' && password === 'password123') {
      // Create JWT token
      const token = jwt.sign(
        { id: 1, email: email },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '1h' }
      );

      // Validate returnTo parameter
      const validatedReturnTo = validateReturnTo(returnTo);
      
      if (!validatedReturnTo) {
        // If returnTo is invalid, use default path
        console.warn('Invalid returnTo parameter attempted:', returnTo);
        return res.json({
          success: true,
          token: token,
          redirectUrl: '/dashboard'
        });
      }

      return res.json({
        success: true,
        token: token,
        redirectUrl: validatedReturnTo
      });
    } else {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET login endpoint with returnTo parameter
app.get('/login', (req, res) => {
  const { returnTo } = req.query;
  
  // Validate and sanitize returnTo
  const validatedReturnTo = validateReturnTo(returnTo);
  
  if (returnTo && !validatedReturnTo) {
    console.warn('Rejected malicious returnTo parameter:', returnTo);
  }

  // Send login form or redirect
  res.json({
    message: 'Please POST credentials to /login',
    safeReturnTo: validatedReturnTo || '/dashboard'
  });
});

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// Protected route example
app.get('/dashboard', authenticateToken, (req, res) => {
  res.json({
    message: 'Welcome to dashboard',
    user: req.user
  });
});

// Protected route that checks returnTo
app.post('/login-with-redirect', authenticateToken, (req, res) => {
  const { returnTo } = req.body;
  
  // Validate returnTo parameter
  const validatedReturnTo = validateReturnTo(returnTo);
  
  if (!validatedReturnTo) {
    console.warn('Invalid returnTo in protected route:', returnTo);
    return res.status(400).json({
      error: 'Invalid redirect URL',
      redirectUrl: '/dashboard'
    });
  }

  res.json({
    success: true,
    message: 'Login successful',
    redirectUrl: validatedReturnTo
  });
});

// Test route to demonstrate the validation
app.get('/test-validation', (req, res) => {
  const testCases = [
    '/dashboard',
    '/profile/settings',
    'https://example.com/page',
    'https://www.example.com/page',
    'https://malicious.com/phishing',
    'javascript:alert("xss")',
    '//evil.com/steal',
    'http://localhost:3000/page',
    '/profile?id=123&return=http://evil.com'
  ];

  const results = testCases.map(testCase => ({
    input: testCase,
    validated: validateReturnTo(testCase),
    isValid: validateReturnTo(testCase) !== null
  }));

  res.json({
    trustedDomains: TRUSTED_DOMAINS,
    testResults: results
  });
});

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Test the validation at: http://localhost:3000/test-validation');
  console.log('Login example: curl -X POST http://localhost:3000/login -H "Content-Type: application/json" -d \'{"email":"user@example.com","password":"password123","returnTo":"/dashboard"}\'');
});

export default app;