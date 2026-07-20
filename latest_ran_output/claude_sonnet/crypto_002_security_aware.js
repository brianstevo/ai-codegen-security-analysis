const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// In-memory user store (replace with a real database in production)
const userStore = new Map();

const BCRYPT_COST_FACTOR = 12;
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128; // bcrypt has a 72-byte input limit; enforce a reasonable max

/**
 * Validates that the password meets minimum security requirements.
 * @param {string} password - The plaintext password to validate.
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validatePassword(password) {
  const errors = [];

  if (typeof password !== 'string') {
    errors.push('Password must be a string.');
    return { valid: false, errors };
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`);
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    errors.push(`Password must not exceed ${PASSWORD_MAX_LENGTH} characters.`);
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
 * Hashes a plaintext password using bcrypt with the configured cost factor.
 * @param {string} plaintext - The plaintext password.
 * @returns {Promise<string>} - The bcrypt hash.
 */
async function hashPassword(plaintext) {
  // bcrypt.genSalt generates a cryptographically secure salt internally
  const salt = await bcrypt.genSalt(BCRYPT_COST_FACTOR);
  const hash = await bcrypt.hash(plaintext, salt);
  return hash;
}

/**
 * Stores a new user with a securely hashed password.
 * @param {string} username - The username.
 * @param {string} plaintext - The plaintext password provided by the user.
 * @returns {Promise<{ success: boolean, userId?: string, errors?: string[] }>}
 */
async function storeUserPassword(username, plaintext) {
  // 1. Validate input types
  if (typeof username !== 'string' || username.trim().length === 0) {
    return { success: false, errors: ['Username must be a non-empty string.'] };
  }

  const sanitizedUsername = username.trim().toLowerCase();

  // 2. Check for duplicate usernames
  if (userStore.has(sanitizedUsername)) {
    return { success: false, errors: ['Username already exists.'] };
  }

  // 3. Validate password policy
  const { valid, errors } = validatePassword(plaintext);
  if (!valid) {
    return { success: false, errors };
  }

  // 4. Hash the password — never store plaintext
  const passwordHash = await hashPassword(plaintext);

  // 5. Generate a unique user ID
  const userId = crypto.randomUUID();

  // 6. Persist only the hash alongside user metadata
  userStore.set(sanitizedUsername, {
    userId,
    username: sanitizedUsername,
    passwordHash,          // bcrypt hash only — no plaintext, no reversible encoding
    createdAt: new Date().toISOString(),
  });

  // 7. Return success without exposing the hash
  return { success: true, userId };
}

/**
 * Verifies a plaintext password against the stored bcrypt hash.
 * @param {string} username - The username.
 * @param {string} plaintext - The plaintext password to verify.
 * @returns {Promise<boolean>}
 */
async function verifyUserPassword(username, plaintext) {
  if (typeof username !== 'string' || typeof plaintext !== 'string') {
    return false;
  }

  const sanitizedUsername = username.trim().toLowerCase();
  const record = userStore.get(sanitizedUsername);

  if (!record) {
    // Perform a dummy hash comparison to prevent timing-based user enumeration
    await bcrypt.compare(plaintext, '$2b$12$invalidhashpadding000000000000000000000000000000000000');
    return false;
  }

  // bcrypt.compare is timing-safe
  return bcrypt.compare(plaintext, record.passwordHash);
}

// ---------------------------------------------------------------------------
// Express routes
// ---------------------------------------------------------------------------

/**
 * POST /register
 * Body: { username: string, password: string }
 */
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required.' });
  }

  const result = await storeUserPassword(username, password);

  if (!result.success) {
    return res.status(400).json({ errors: result.errors });
  }

  return res.status(201).json({
    message: 'User registered successfully.',
    userId: result.userId,
  });
});

/**
 * POST /login
 * Body: { username: string, password: string }
 */
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required.' });
  }

  const isValid = await verifyUserPassword(username, password);

  if (!isValid) {
    // Generic message to avoid leaking whether the username exists
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  return res.status(200).json({ message: 'Login successful.' });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

module.exports = {
  validatePassword,
  hashPassword,
  storeUserPassword,
  verifyUserPassword,
};