const express = require('express');
const app = express();

// Middleware to set cache prevention headers
const noCacheHeaders = (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
};

// Apply no-cache headers to all routes (can be applied selectively)
app.use(noCacheHeaders);

// Parse JSON bodies
app.use(express.json());

// Simulated user database (in production, use a real database)
const users = {
  'user123': {
    id: 'user123',
    email: 'user@example.com',
    username: 'johndoe',
    accountBalance: 15000.50,
    creditCard: '****-****-****-4242',
    ssn: '***-**-1234',
    accountStatus: 'active',
    createdAt: '2023-01-15',
    lastLogin: '2024-01-10T14:30:00Z'
  },
  'user456': {
    id: 'user456',
    email: 'admin@example.com',
    username: 'admin',
    accountBalance: 50000.00,
    creditCard: '****-****-****-5555',
    ssn: '***-**-5678',
    accountStatus: 'active',
    createdAt: '2022-06-01',
    lastLogin: '2024-01-11T09:15:00Z'
  }
};

// Simulated authentication middleware
const authenticateUser = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }
  
  const token = authHeader.substring(7);
  // Simple token validation (in production, use proper JWT verification)
  if (token.length < 10) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
  
  // Extract user ID from token (simplified)
  const userId = req.headers['x-user-id'] || 'user123';
  
  if (!users[userId]) {
    return res.status(401).json({ error: 'Unauthorized: User not found' });
  }
  
  req.user = users[userId];
  next();
};

// Route to get sensitive account details
app.get('/api/account/details', authenticateUser, (req, res) => {
  // Return sensitive account information
  const accountDetails = {
    success: true,
    data: {
      id: req.user.id,
      email: req.user.email,
      username: req.user.username,
      accountBalance: req.user.accountBalance,
      creditCard: req.user.creditCard,
      ssn: req.user.ssn,
      accountStatus: req.user.accountStatus,
      createdAt: req.user.createdAt,
      lastLogin: req.user.lastLogin
    },
    message: 'Sensitive account details retrieved successfully'
  };
  
  res.status(200).json(accountDetails);
});

// Route to get account transactions (another sensitive endpoint)
app.get('/api/account/transactions', authenticateUser, (req, res) => {
  const transactions = [
    {
      id: 'txn_001',
      date: '2024-01-10',
      description: 'Online Purchase',
      amount: -49.99,
      balance: 15000.50
    },
    {
      id: 'txn_002',
      date: '2024-01-09',
      description: 'Salary Deposit',
      amount: 3500.00,
      balance: 15050.49
    },
    {
      id: 'txn_003',
      date: '2024-01-08',
      description: 'Utility Bill',
      amount: -120.00,
      balance: 11550.49
    }
  ];
  
  res.status(200).json({
    success: true,
    data: {
      userId: req.user.id,
      transactions: transactions,
      totalCount: transactions.length
    }
  });
});

// Route to verify cache headers are properly set
app.get('/api/security/headers-test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Check response headers for cache prevention directives',
    expectedHeaders: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('\nTest endpoints:');
  console.log(`GET /api/account/details - Requires Authorization header with Bearer token`);
  console.log(`GET /api/account/transactions - Requires Authorization header with Bearer token`);
  console.log(`GET /api/security/headers-test - Check cache prevention headers`);
  console.log('\nExample curl command:');
  console.log('curl -H "Authorization: Bearer test-token-12345" -H "x-user-id: user123" http://localhost:3000/api/account/details');
});