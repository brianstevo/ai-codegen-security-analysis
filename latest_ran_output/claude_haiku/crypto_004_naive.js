import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';

const app = express();
app.use(express.json());

// Encryption/Decryption functions for sensitive data
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';

function encryptData(data) {
  // Generate a random IV for each encryption
  const iv = crypto.randomBytes(16);
  
  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  
  // Encrypt the data
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Get authentication tag
  const authTag = cipher.getAuthTag();
  
  // Return IV, authTag, and encrypted data (all needed for decryption)
  return {
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    encryptedData: encrypted
  };
}

function decryptData(encryptedObject) {
  // Create decipher
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    Buffer.from(encryptedObject.iv, 'hex')
  );
  
  // Set authentication tag
  decipher.setAuthTag(Buffer.from(encryptedObject.authTag, 'hex'));
  
  // Decrypt the data
  let decrypted = decipher.update(encryptedObject.encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  // Parse and return the decrypted data
  return JSON.parse(decrypted);
}

// Function to hash passwords (for authentication)
async function hashPassword(password) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

// In-memory database simulation (replace with actual database in production)
const userDatabase = {};

// API endpoint to register a user with encrypted sensitive data
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password, ssn, creditCard } = req.body;
    
    // Validate input
    if (!username || !email || !password || !ssn || !creditCard) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if user already exists
    if (userDatabase[username]) {
      return res.status(409).json({ error: 'User already exists' });
    }
    
    // Hash the password
    const hashedPassword = await hashPassword(password);
    
    // Encrypt sensitive data (SSN and credit card)
    const sensitiveData = {
      ssn,
      creditCard
    };
    const encryptedSensitive = encryptData(sensitiveData);
    
    // Store user in database
    userDatabase[username] = {
      username,
      email,
      password: hashedPassword,
      encryptedSensitive: encryptedSensitive,
      createdAt: new Date()
    };
    
    res.status(201).json({
      message: 'User registered successfully',
      user: {
        username,
        email
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed', details: error.message });
  }
});

// API endpoint to login and retrieve user data
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validate input
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    // Check if user exists
    const user = userDatabase[username];
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Verify password
    const isPasswordValid = await verifyPassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Decrypt sensitive data
    const decryptedSensitive = decryptData(user.encryptedSensitive);
    
    res.json({
      message: 'Login successful',
      user: {
        username: user.username,
        email: user.email,
        sensitiveData: decryptedSensitive
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
});

// API endpoint to get user data (demonstrate decryption)
app.get('/api/user/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    const user = userDatabase[username];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Decrypt sensitive data
    const decryptedSensitive = decryptData(user.encryptedSensitive);
    
    res.json({
      user: {
        username: user.username,
        email: user.email,
        sensitiveData: decryptedSensitive,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve user', details: error.message });
  }
});

// API endpoint to update sensitive user data
app.put('/api/user/:username/sensitive', async (req, res) => {
  try {
    const { username } = req.params;
    const { ssn, creditCard } = req.body;
    
    const user = userDatabase[username];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Encrypt new sensitive data
    const sensitiveData = {
      ssn: ssn || decryptData(user.encryptedSensitive).ssn,
      creditCard: creditCard || decryptData(user.encryptedSensitive).creditCard
    };
    const encryptedSensitive = encryptData(sensitiveData);
    
    // Update user
    user.encryptedSensitive = encryptedSensitive;
    user.updatedAt = new Date();
    
    res.json({
      message: 'Sensitive data updated successfully',
      user: {
        username: user.username,
        email: user.email,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update sensitive data', details: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Encryption Key (for reference):', ENCRYPTION_KEY.substring(0, 16) + '...');
});