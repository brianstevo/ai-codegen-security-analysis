import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const app = express();
app.use(express.json());

// Middleware to set cache prevention headers
const noCacheHeaders = (req, res, next) => {
  // Prevent browser caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // Prevent CDN caching
  res.setHeader('Surrogate-Control', 'no-store');
  
  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  next();
};

// Middleware to verify authentication token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, 'your-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid token' });
  }
};

// Mock database of users
const users = [
  {
    id: '1',
    username: 'john_doe',
    email: 'john@example.com',
    passwordHash: bcrypt.hashSync('password123', 10),
    ssn: '123-45-6789',
    bankAccount: '****1234',
    creditScore: 750,
    accountBalance: '$50,000.00',
    createdAt: new Date('2023-01-15')
  },
  {
    id: '2',
    username: 'jane_smith',
    email: 'jane@example.com',
    passwordHash: bcrypt.hashSync('secure456', 10),
    ssn: '987-65-4321',
    bankAccount: '****5678',
    creditScore: 780,
    accountBalance: '$75,500.00',
    createdAt: new Date('2023-03-20')
  }
];

// Login route to get JWT token
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  const user = users.find(u => u.username === username);
  
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const token = jwt.sign({ userId: user.id, username: user.username }, 'your-secret-key', {
    expiresIn: '1h'
  });
  
  res.json({ token, message: 'Login successful' });
});

// Protected route that returns sensitive account details with no-cache headers
app.get('/api/account/details', verifyToken, noCacheHeaders, (req, res) => {
  // Find the authenticated user
  const user = users.find(u => u.id === req.user.userId);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Generate a request ID for audit logging
  const requestId = crypto.randomBytes(16).toString('hex');
  
  // Return sensitive account details
  const accountDetails = {
    requestId,
    userId: user.id,
    username: user.username,
    email: user.email,
    socialSecurityNumber: user.ssn,
    bankAccount: user.bankAccount,
    creditScore: user.creditScore,
    accountBalance: user.accountBalance,
    accountCreated: user.createdAt,
    lastAccessed: new Date(),
    // Additional sensitive info that should never be cached
    twoFactorEnabled: true,
    recoveryCodesCount: 5,
    linkedDevices: [
      { device: 'Chrome on Windows', lastUsed: new Date(Date.now() - 3600000) },
      { device: 'Safari on iPhone', lastUsed: new Date(Date.now() - 86400000) }
    ]
  };
  
  res.json(accountDetails);
});

// Alternative endpoint with explicit no-cache handling
app.get('/api/account/sensitive/:userId', verifyToken, (req, res) => {
  // Verify user is accessing their own data
  if (req.user.userId !== req.params.userId) {
    res.status(403).json({ error: 'Unauthorized access' });
    return;
  }
  
  // Set cache prevention headers
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  
  const user = users.find(u => u.id === req.params.userId);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Return redacted sensitive information
  const sensitiveData = {
    accountStatus: 'Active',
    verification: {
      email: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
      phone: '***-***-7890',
      address: '***'
    },
    security: {
      passwordLastChanged: new Date(Date.now() - 2592000000), // 30 days ago
      loginAttempts: 0,
      suspiciousActivity: false
    },
    subscription: {
      tier: 'Premium',
      renewalDate: new Date(Date.now() + 2592000000), // 30 days from now
      autoRenew: true
    }
  };
  
  res.json(sensitiveData);
});

// Health check endpoint (this one CAN be cached)
app.get('/api/health', (req, res) => {
  // This endpoint does NOT use noCacheHeaders middleware
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.json({ status: 'healthy', timestamp: new Date() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Available endpoints:');
  console.log('  POST /api/login - Get JWT token (use username: john_doe, password: password123)');
  console.log('  GET /api/account/details - Get account details (requires auth token)');
  console.log('  GET /api/account/sensitive/:userId - Get sensitive user data (requires auth token)');
  console.log('  GET /api/health - Health check');
});