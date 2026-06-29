```javascript
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const app = express();
const PORT = 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Simple in-memory database for demonstration
const users = new Map();
const accounts = new Map();
const transactions = [];

// Secret key for JWT
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Initialize some test data
function initializeTestData() {
  // Create test users
  const user1 = {
    id: crypto.randomUUID(),
    username: 'alice',
    passwordHash: bcrypt.hashSync('password123', 10),
    email: 'alice@example.com'
  };
  
  const user2 = {
    id: crypto.randomUUID(),
    username: 'bob',
    passwordHash: bcrypt.hashSync('password123', 10),
    email: 'bob@example.com'
  };
  
  users.set(user1.id, user1);
  users.set(user2.id, user2);
  
  // Create test accounts
  const account1 = {
    id: crypto.randomUUID(),
    userId: user1.id,
    accountNumber: '1001',
    balance: 5000,
    accountType: 'checking'
  };
  
  const account2 = {
    id: crypto.randomUUID(),
    userId: user2.id,
    accountNumber: '2001',
    balance: 3000,
    accountType: 'savings'
  };
  
  accounts.set(account1.id, account1);
  accounts.set(account2.id, account2);
}

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.userId = decoded.userId;
    next();
  });
}

// Login route - returns JWT token
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  // Find user by username
  let user = null;
  for (const [, u] of users.entries()) {
    if (u.username === username) {
      user = u;
      break;
    }
  }
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  // Verify password
  if (!bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  // Generate JWT token
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
  
  res.json({ 
    message: 'Login successful',
    token: token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email
    }
  });
});

// Get user's accounts
app.get('/accounts', authenticateToken, (req, res) => {
  const userAccounts = [];
  for (const [, account] of accounts.entries()) {
    if (account.userId === req.userId) {
      userAccounts.push(account);
    }
  }
  
  res.json({ accounts: userAccounts });
});

// Transfer funds route - handles form submission
app.post('/transfer', authenticateToken, (req, res) => {
  try {
    const { fromAccountId, toAccountNumber, amount, description } = req.body;
    
    // Validation
    if (!fromAccountId || !toAccountNumber || !amount) {
      return res.status(400).json({ 
        error: 'Missing required fields: fromAccountId, toAccountNumber, amount' 
      });
    }
    
    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }
    
    // Get from account
    const fromAccount = accounts.get(fromAccountId);
    if (!fromAccount) {
      return res.status(404).json({ error: 'From account not found' });
    }
    
    // Verify user owns the from account
    if (fromAccount.userId !== req.userId) {
      return res.status(403).json({ error: 'You do not have permission to transfer from this account' });
    }
    
    // Check sufficient funds
    if (fromAccount.balance < transferAmount) {
      return res.status(400).json({ error: 'Insufficient funds' });
    }
    
    // Find to account by account number
    let toAccount = null;
    for (const [, account] of accounts.entries()) {
      if (account.accountNumber === toAccountNumber) {
        toAccount = account;
        break;
      }
    }
    
    if (!toAccount) {
      return res.status(404).json({ error: 'Recipient account not found' });
    }
    
    // Prevent self-transfer
    if (fromAccount.id === toAccount.id) {
      return res.status(400).json({ error: 'Cannot transfer to the same account' });
    }
    
    // Execute transfer
    fromAccount.balance -= transferAmount;
    toAccount.balance += transferAmount;
    
    // Record transaction
    const transaction = {
      id: crypto.randomUUID(),
      fromAccountId: fromAccount.id,
      toAccountId: toAccount.id,
      fromUserId: req.userId,
      toUserId: toAccount.userId,
      amount: transferAmount,
      description: description || 'Fund transfer',
      timestamp: new Date(),
      status: 'completed'
    };
    
    transactions.push(transaction);
    
    // Return success response
    res.status(200).json({
      message: 'Transfer completed successfully',
      transaction: {
        id: transaction.id,
        fromAccount: {
          id: fromAccount.id,
          accountNumber: fromAccount.accountNumber,
          newBalance: fromAccount.balance
        },
        toAccount: {
          id: toAccount.id,
          accountNumber: toAccount.accountNumber,
          newBalance: toAccount.balance
        },
        amount: transferAmount,
        description: transaction.description,
        timestamp: transaction.timestamp
      }
    });
    
  } catch (error) {
    console.error('Transfer error:', error);
    res.status(500).json({ error: 'An error occurred during the transfer' });
  }
});

// Get transaction history
app.get('/transactions', authenticateToken, (req, res) => {
  const userTransactions = transactions.filter(t => 
    t.fromUserId === req.userId || t.toUserId === req.userId
  );
  
  res.json({ transactions: userTransactions });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize test data and start server
initializeTestData();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('\nTest credentials:');
  console.log('Username: alice, Password: password123');
  console.log('Username: bob, Password: password123');
  console.log('\nTo test the API:');
  console.log('