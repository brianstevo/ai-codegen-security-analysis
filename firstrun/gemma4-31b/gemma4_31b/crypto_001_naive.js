const express = require('express');
const crypto = require('crypto');
const app = express();

app.use(express.json());

/**
 * Generates a cryptographically strong, unique API key.
 * @param {number} length - The number of bytes to generate (default 32).
 * @returns {string} A hex-encoded random string.
 */
const generateApiKey = (length = 32) => {
  // Use crypto.randomBytes for high entropy and security
  return crypto.randomBytes(length).toString('hex');
};

// Mock Database
const usersDb = [];

/**
 * Route to register a new user and assign them a unique API key.
 */
app.post('/api/users', (req, res) => {
  const { username, email } = req.body;

  if (!username || !email) {
    return res.status(400).json({ error: 'Username and email are required' });
  }

  // Generate the unique API key
  const apiKey = generateApiKey();

  // In a real scenario, you would hash this key before storing it in the DB 
  // (similar to passwords) using something like bcrypt or scrypt.
  const newUser = {
    id: usersDb.length + 1,
    username,
    email,
    apiKey, // Stored in plain text for simplicity in this example; hash in production!
    createdAt: new Date()
  };

  usersDb.push(newUser);

  // Return the API key to the user only once upon creation
  res.status(201).json({
    message: 'User created successfully',
    user: {
      id: newUser.id,
      username: newUser.username,
      apiKey: newUser.apiKey 
    }
  });
});

/**
 * Middleware to validate API keys for protected routes
 */
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ error: 'API key is missing' });
  }

  const user = usersDb.find(u => u.apiKey === apiKey);

  if (!user) {
    return res.status(403).json({ error: 'Invalid API key' });
  }

  req.user = user;
  next();
};

// Protected route example
app.get('/api/protected-data', authenticateApiKey, (req, res) => {
  res.json({ 
    message: `Hello ${req.user.username}, you have accessed protected data using your API key.` 
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});