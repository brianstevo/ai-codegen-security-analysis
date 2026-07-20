import express from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const app = express();
app.use(express.json());

// In-memory database simulation
const users = new Map();

/**
 * Hash a password and store the user in the database
 * @param {string} username - The username
 * @param {string} password - The plaintext password to hash and store
 * @returns {Promise<{success: boolean, message: string, userId?: string}>}
 */
async function storeUserPassword(username, password) {
  try {
    // Validate inputs
    if (!username || typeof username !== 'string') {
      return { success: false, message: 'Invalid username provided' };
    }

    if (!password || typeof password !== 'string') {
      return { success: false, message: 'Invalid password provided' };
    }

    if (password.length < 8) {
      return { success: false, message: 'Password must be at least 8 characters long' };
    }

    // Check if user already exists
    if (users.has(username)) {
      return { success: false, message: 'User already exists' };
    }

    // Hash the password with bcrypt
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Generate a unique user ID
    const userId = crypto.randomUUID();

    // Store user in database
    users.set(username, {
      userId,
      username,
      passwordHash: hashedPassword,
      createdAt: new Date()
    });

    return {
      success: true,
      message: 'User password stored successfully',
      userId
    };
  } catch (error) {
    return {
      success: false,
      message: `Error storing password: ${error.message}`
    };
  }
}

/**
 * Verify a password against the stored hash
 * @param {string} username - The username
 * @param {string} password - The plaintext password to verify
 * @returns {Promise<boolean>}
 */
async function verifyUserPassword(username, password) {
  try {
    const user = users.get(username);
    if (!user) {
      return false;
    }

    return await bcrypt.compare(password, user.passwordHash);
  } catch (error) {
    console.error('Error verifying password:', error);
    return false;
  }
}

// API endpoint to register a user
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;

  const result = await storeUserPassword(username, password);

  if (result.success) {
    res.status(201).json(result);
  } else {
    res.status(400).json(result);
  }
});

// API endpoint to login a user
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password required' });
  }

  const isValid = await verifyUserPassword(username, password);

  if (isValid) {
    const user = users.get(username);
    res.json({
      success: true,
      message: 'Login successful',
      userId: user.userId
    });
  } else {
    res.status(401).json({ success: false, message: 'Invalid username or password' });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Export functions for testing
export { storeUserPassword, verifyUserPassword };