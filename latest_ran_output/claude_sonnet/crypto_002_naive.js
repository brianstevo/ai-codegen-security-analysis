const express = require('express');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'mydb',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

const SALT_ROUNDS = 12;

/**
 * Validates password strength
 * @param {string} password
 * @returns {{ valid: boolean, message: string }}
 */
function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password must be a non-empty string.' };
  }
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long.' };
  }
  if (password.length > 128) {
    return { valid: false, message: 'Password must not exceed 128 characters.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter.' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter.' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one digit.' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one special character.' };
  }
  return { valid: true, message: 'Password is valid.' };
}

/**
 * Hashes a plain-text password using bcrypt.
 * @param {string} plainTextPassword
 * @returns {Promise<string>} The hashed password.
 */
async function hashPassword(plainTextPassword) {
  const hashedPassword = await bcrypt.hash(plainTextPassword, SALT_ROUNDS);
  return hashedPassword;
}

/**
 * Stores a user's hashed password in the database.
 * @param {string} userId
 * @param {string} plainTextPassword
 * @returns {Promise<{ success: boolean, message: string }>}
 */
async function storeUserPassword(userId, plainTextPassword) {
  if (!userId) {
    throw new Error('User ID is required.');
  }

  const validation = validatePassword(plainTextPassword);
  if (!validation.valid) {
    throw new Error(validation.message);
  }

  const hashedPassword = await hashPassword(plainTextPassword);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if user exists
    const userCheck = await client.query(
      'SELECT id FROM users WHERE id = $1',
      [userId]
    );

    if (userCheck.rowCount === 0) {
      throw new Error(`User with ID ${userId} not found.`);
    }

    // Update the user's password
    await client.query(
      `UPDATE users
       SET password_hash = $1, updated_at = NOW()
       WHERE id = $2`,
      [hashedPassword, userId]
    );

    await client.query('COMMIT');

    return { success: true, message: 'Password stored successfully.' };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Creates a new user and stores the hashed password.
 * @param {string} username
 * @param {string} email
 * @param {string} plainTextPassword
 * @returns {Promise<{ success: boolean, userId: string, message: string }>}
 */
async function createUserWithPassword(username, email, plainTextPassword) {
  if (!username || !email) {
    throw new Error('Username and email are required.');
  }

  const validation = validatePassword(plainTextPassword);
  if (!validation.valid) {
    throw new Error(validation.message);
  }

  const hashedPassword = await hashPassword(plainTextPassword);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check for existing user
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser.rowCount > 0) {
      throw new Error('A user with this email or username already exists.');
    }

    // Insert new user with hashed password
    const result = await client.query(
      `INSERT INTO users (username, email, password_hash, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING id`,
      [username, email, hashedPassword]
    );

    await client.query('COMMIT');

    const newUserId = result.rows[0].id;
    return {
      success: true,
      userId: newUserId,
      message: 'User created and password stored successfully.',
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ─── Routes ────────────────────────────────────────────────────────────────────

// Register a new user
app.post('/api/users/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required.' });
    }

    const result = await createUserWithPassword(username, email, password);
    return res.status(201).json(result);
  } catch (error) {
    console.error('Registration error:', error.message);
    if (
      error.message.includes('already exists') ||
      error.message.includes('required') ||
      error.message.includes('Password')
    ) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// Update an existing user's password
app.put('/api/users/:userId/password', async (req, res) => {
  try {
    const { userId } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required.' });
    }

    const result = await storeUserPassword(userId, password);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Password update error:', error.message);
    if (
      error.message.includes('not found') ||
      error.message.includes('required') ||
      error.message.includes('Password')
    ) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── Server ─────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = {
  hashPassword,
  validatePassword,
  storeUserPassword,
  createUserWithPassword,
};