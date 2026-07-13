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
 * Hashes a plain-text password using bcrypt
 * @param {string} plainTextPassword
 * @returns {Promise<string>} hashed password
 */
async function hashPassword(plainTextPassword) {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  const hashedPassword = await bcrypt.hash(plainTextPassword, salt);
  return hashedPassword;
}

/**
 * Stores a user's hashed password in the database
 * @param {string} username
 * @param {string} plainTextPassword
 * @returns {Promise<{ id: number, username: string, createdAt: Date }>}
 */
async function storeUserPassword(username, plainTextPassword) {
  if (!username || typeof username !== 'string' || username.trim() === '') {
    throw new Error('A valid username is required.');
  }

  const { valid, message } = validatePassword(plainTextPassword);
  if (!valid) {
    throw new Error(message);
  }

  const sanitizedUsername = username.trim().toLowerCase();

  // Check if the user already exists
  const existingUser = await pool.query(
    'SELECT id FROM users WHERE username = $1',
    [sanitizedUsername]
  );

  if (existingUser.rows.length > 0) {
    throw new Error('Username already exists.');
  }

  // Hash the password
  const hashedPassword = await hashPassword(plainTextPassword);

  // Store the user with the hashed password
  const result = await pool.query(
    `INSERT INTO users (username, password_hash, created_at)
     VALUES ($1, $2, NOW())
     RETURNING id, username, created_at`,
    [sanitizedUsername, hashedPassword]
  );

  return result.rows[0];
}

/**
 * Updates a user's password in the database
 * @param {number} userId
 * @param {string} currentPassword
 * @param {string} newPassword
 * @returns {Promise<{ success: boolean, message: string }>}
 */
async function updateUserPassword(userId, currentPassword, newPassword) {
  if (!userId || isNaN(userId)) {
    throw new Error('A valid user ID is required.');
  }

  // Fetch current password hash
  const result = await pool.query(
    'SELECT password_hash FROM users WHERE id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    throw new Error('User not found.');
  }

  const { password_hash } = result.rows[0];

  // Verify current password
  const isMatch = await bcrypt.compare(currentPassword, password_hash);
  if (!isMatch) {
    throw new Error('Current password is incorrect.');
  }

  // Ensure new password is different
  const isSamePassword = await bcrypt.compare(newPassword, password_hash);
  if (isSamePassword) {
    throw new Error('New password must be different from the current password.');
  }

  // Validate new password
  const { valid, message } = validatePassword(newPassword);
  if (!valid) {
    throw new Error(message);
  }

  // Hash and store new password
  const newHashedPassword = await hashPassword(newPassword);

  await pool.query(
    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
    [newHashedPassword, userId]
  );

  return { success: true, message: 'Password updated successfully.' };
}

// --- Routes ---

// Register a new user with a password
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const user = await storeUserPassword(username, password);
    return res.status(201).json({
      message: 'User registered successfully.',
      user: {
        id: user.id,
        username: user.username,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error('Registration error:', error.message);
    const statusCode = error.message === 'Username already exists.' ? 409 : 400;
    return res.status(statusCode).json({ error: error.message });
  }
});

// Update an existing user's password
app.put('/users/:id/password', async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new passwords are required.' });
  }

  try {
    const result = await updateUserPassword(userId, currentPassword, newPassword);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Password update error:', error.message);
    const statusCode =
      error.message === 'User not found.' ? 404 :
      error.message === 'Current password is incorrect.' ? 401 : 400;
    return res.status(statusCode).json({ error: error.message });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = {
  storeUserPassword,
  updateUserPassword,
  hashPassword,
  validatePassword,
};