const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// In-memory user store (replace with a real database in production)
const users = new Map();

const BCRYPT_COST_FACTOR = 12;
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128; // Prevent bcrypt DoS via long passwords

/**
 * Validates password meets minimum security requirements
 * @param {string} password
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validatePassword(password) {
  const errors = [];

  if (typeof password !== 'string') {
    errors.push('Password must be a string.');
    return { valid: false, errors };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    errors.push(`Password must not exceed ${MAX_PASSWORD_LENGTH} characters.`);
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter.');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter.');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one digit.');
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character.');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Hashes a password using bcrypt with the configured cost factor.
 * @param {string} password - The plaintext password to hash.
 * @returns {Promise<string>} - The bcrypt hash.
 */
async function hashPassword(password) {
  const { valid, errors } = validatePassword(password);

  if (!valid) {
    const error = new Error('Password validation failed: ' + errors.join(' '));
    error.code = 'PASSWORD_VALIDATION_ERROR';
    error.details = errors;
    throw error;
  }

  // Generate salt and hash in one step using bcrypt.hash
  const hash = await bcrypt.hash(password, BCRYPT_COST_FACTOR);
  return hash;
}

/**
 * Stores a new user with a securely hashed password.
 * @param {string} username
 * @param {string} password - Plaintext password (will be hashed, never stored)
 * @returns {Promise<{ id: string, username: string, createdAt: string }>}
 */
async function storeUser(username, password) {
  if (!username || typeof username !== 'string' || username.trim().length === 0) {
    const error = new Error('A valid username is required.');
    error.code = 'INVALID_USERNAME';
    throw error;
  }

  const normalizedUsername = username.trim().toLowerCase();

  if (users.has(normalizedUsername)) {
    const error = new Error('Username already exists.');
    error.code = 'USER_EXISTS';
    throw error;
  }

  // Hash the password — validation is enforced inside hashPassword()
  const passwordHash = await hashPassword(password);

  const userId = crypto.randomUUID();
  const now = new Date().toISOString();

  const userRecord = {
    id: userId,
    username: normalizedUsername,
    passwordHash, // Only the hash is stored — never the plaintext
    createdAt: now,
    updatedAt: now,
  };

  users.set(normalizedUsername, userRecord);

  // Return a safe subset — never expose the hash to callers
  return {
    id: userRecord.id,
    username: userRecord.username,
    createdAt: userRecord.createdAt,
  };
}

/**
 * Verifies a plaintext password against a stored bcrypt hash.
 * Uses a constant-time comparison (bcrypt.compare) to prevent timing attacks.
 * @param {string} username
 * @param {string} candidatePassword
 * @returns {Promise<boolean>}
 */
async function verifyPassword(username, candidatePassword) {
  const normalizedUsername = username.trim().toLowerCase();
  const userRecord = users.get(normalizedUsername);

  // Perform a dummy hash comparison even when the user doesn't exist
  // to prevent user enumeration via timing differences.
  if (!userRecord) {
    const dummyHash = '$2b$12$invalidhashfortimingprotectiononly00000000000000000000000';
    await bcrypt.compare(candidatePassword, dummyHash).catch(() => false);
    return false;
  }

  const isMatch = await bcrypt.compare(candidatePassword, userRecord.passwordHash);
  return isMatch;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required.' });
    }

    const user = await storeUser(username, password);
    return res.status(201).json({ message: 'User registered successfully.', user });
  } catch (err) {
    if (err.code === 'PASSWORD_VALIDATION_ERROR') {
      return res.status(400).json({ error: err.message, details: err.details });
    }
    if (err.code === 'USER_EXISTS') {
      return res.status(409).json({ error: err.message });
    }
    if (err.code === 'INVALID_USERNAME') {
      return res.status(400).json({ error: err.message });
    }
    console.error('Unexpected registration error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const isValid = await verifyPassword(username, password);

    if (!isValid) {
      // Generic message to avoid revealing whether the username exists
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    return res.status(200).json({ message: 'Login successful.' });
  } catch (err) {
    console.error('Unexpected login error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── Server ───────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Bcrypt cost factor: ${BCRYPT_COST_FACTOR}`);
  console.log(`Minimum password length: ${MIN_PASSWORD_LENGTH}`);
});

module.exports = { hashPassword, storeUser, verifyPassword, validatePassword };