```javascript
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(express.json());

// ─── Configuration ────────────────────────────────────────────────────────────

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY
  ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex')
  : crypto.randomBytes(32); // 256-bit key for AES-256

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;   // 128-bit IV
const TAG_LENGTH = 16;  // 128-bit auth tag
const SALT_ROUNDS = 12;

// ─── MongoDB Schema ───────────────────────────────────────────────────────────

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/securedb');

const userSchema = new mongoose.Schema({
  username:       { type: String, required: true, unique: true },
  passwordHash:   { type: String, required: true },           // bcrypt hash
  email:          { type: String, required: true },            // AES-256-GCM encrypted
  phoneNumber:    { type: String },                            // AES-256-GCM encrypted
  ssn:            { type: String },                            // AES-256-GCM encrypted
  creditCard:     { type: String },                            // AES-256-GCM encrypted
  dateOfBirth:    { type: String },                            // AES-256-GCM encrypted
  createdAt:      { type: Date, default: Date.now },
  updatedAt:      { type: Date, default: Date.now },
});

const User = mongoose.model('User', userSchema);

// ─── Encryption Helpers ───────────────────────────────────────────────────────

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a colon-delimited string: iv:authTag:ciphertext (all hex-encoded).
 *
 * @param {string} plaintext - The sensitive data to encrypt.
 * @returns {string} - Encrypted payload string.
 */
function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined) return null;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv, {
    authTagLength: TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(String(plaintext), 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Store as iv:authTag:ciphertext
  return [
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':');
}

/**
 * Decrypts an AES-256-GCM encrypted payload produced by `encrypt()`.
 *
 * @param {string} encryptedPayload - The colon-delimited encrypted string.
 * @returns {string} - Original plaintext.
 */
function decrypt(encryptedPayload) {
  if (!encryptedPayload) return null;

  const [ivHex, authTagHex, ciphertextHex] = encryptedPayload.split(':');

  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error('Invalid encrypted payload format.');
  }

  const iv         = Buffer.from(ivHex, 'hex');
  const authTag    = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv, {
    authTagLength: TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Hashes a password using bcrypt.
 *
 * @param {string} password - The plain-text password.
 * @returns {Promise<string>} - The bcrypt hash.
 */
async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verifies a password against its bcrypt hash.
 *
 * @param {string} password - The plain-text password.
 * @param {string} hash     - The stored bcrypt hash.
 * @returns {Promise<boolean>}
 */
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// ─── Fields that must be encrypted at rest ───────────────────────────────────

const SENSITIVE_FIELDS = ['email', 'phoneNumber', 'ssn', 'creditCard', 'dateOfBirth'];

/**
 * Encrypts all sensitive fields in a user-data object.
 *
 * @param {Object} userData - Raw user data from the request.
 * @returns {Object} - A new object with sensitive fields encrypted.
 */
function encryptSensitiveFields(userData) {
  const encrypted = { ...userData };

  for (const field of SENSITIVE_FIELDS) {
    if (encrypted[field] !== undefined && encrypted[field] !== null) {
      encrypted[field] = encrypt(encrypted[field]);
    }
  }

  return encrypted;
}

/**
 * Decrypts all sensitive fields in a stored user document.
 *
 * @param {Object} storedUser - The raw document from the database.
 * @returns {Object} - A plain object with sensitive fields decrypted.
 */
function decryptSensitiveFields(storedUser) {
  const plain = storedUser.toObject ? storedUser.toObject() : { ...storedUser };

  for (const field of SENSITIVE_FIELDS) {
    if (plain[field]) {
      plain[field] = decrypt(plain[field]);
    }
  }

  // Never expose the password hash
  delete plain.passwordHash;
  return plain;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /users
 * Register a new user. Passwords are hashed; other PII is AES-256-GCM encrypted.
 */
app.post('/users', async (req, res) => {
  try {
    const {
      username,
      password,
      email,
      phoneNumber,
      ssn,
      creditCard,
      dateOfBirth,
    } = req.body;

    if (!username || !password || !email) {
      return res.status(400).json({ error: 'username, password, and email are required.' });
    }

    // Hash the password
    const passwordHash = await hashPassword(password);

    // Encrypt all sensitive fields
    const encryptedData = encryptSensitiveFields({
      email,
      phoneNumber,
      ssn,
      creditCard,
      dateOfBirth,
    });

    const user = new User({
      username,
      passwordHash,
      ...encryptedData,
    });

    await user.save();

    return res.status(201).json({
      message: 'User created successfully.',
      userId: user._id,
      username: user.username,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Username already exists.' });
    }
    console.error('Error creating user:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /users/:id
 * Retrieve a user by ID. Sensitive fields are decrypted before returning.
 */
app.get('/users/:id', async (req