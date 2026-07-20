```javascript
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

// Configuration
const CONFIG = {
  ENCRYPTION_ALGORITHM: 'aes-256-gcm',
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'),
  IV_LENGTH: 16,
  AUTH_TAG_LENGTH: 16,
  SALT_ROUNDS: 12,
  JWT_SECRET: process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex'),
  JWT_EXPIRY: '24h',
};

// Derive a consistent encryption key from the hex string
const getEncryptionKey = () => {
  const keyHex = CONFIG.ENCRYPTION_KEY;
  return Buffer.from(keyHex.slice(0, 64), 'hex'); // 32 bytes
};

// MongoDB User Schema
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    sensitiveData: {
      ssn: String,
      creditCard: String,
      bankAccount: String,
      dateOfBirth: String,
      phoneNumber: String,
      address: String,
    },
    dataIV: {
      ssn: String,
      creditCard: String,
      bankAccount: String,
      dateOfBirth: String,
      phoneNumber: String,
      address: String,
    },
    dataAuthTag: {
      ssn: String,
      creditCard: String,
      bankAccount: String,
      dateOfBirth: String,
      phoneNumber: String,
      address: String,
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model('User', userSchema);

/**
 * Encrypts a plain text string using AES-256-GCM
 * @param {string} plainText - The text to encrypt
 * @returns {Object} - Object containing encrypted data, IV, and auth tag
 */
const encryptData = (plainText) => {
  if (!plainText) {
    return { encrypted: null, iv: null, authTag: null };
  }

  try {
    const iv = crypto.randomBytes(CONFIG.IV_LENGTH);
    const key = getEncryptionKey();

    const cipher = crypto.createCipheriv(CONFIG.ENCRYPTION_ALGORITHM, key, iv);

    let encrypted = cipher.update(String(plainText), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      encrypted: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
};

/**
 * Decrypts an encrypted string using AES-256-GCM
 * @param {string} encryptedText - The encrypted hex string
 * @param {string} ivHex - The IV as hex string
 * @param {string} authTagHex - The auth tag as hex string
 * @returns {string} - The decrypted plain text
 */
const decryptData = (encryptedText, ivHex, authTagHex) => {
  if (!encryptedText || !ivHex || !authTagHex) {
    return null;
  }

  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(CONFIG.ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
};

/**
 * Encrypts all sensitive fields in a user data object
 * @param {Object} sensitiveFields - Object containing sensitive user data
 * @returns {Object} - Object with encrypted data, IVs, and auth tags
 */
const encryptSensitiveUserData = (sensitiveFields) => {
  const encryptedData = {};
  const ivData = {};
  const authTagData = {};

  const fieldsToEncrypt = [
    'ssn',
    'creditCard',
    'bankAccount',
    'dateOfBirth',
    'phoneNumber',
    'address',
  ];

  for (const field of fieldsToEncrypt) {
    if (sensitiveFields[field] !== undefined && sensitiveFields[field] !== null) {
      const { encrypted, iv, authTag } = encryptData(sensitiveFields[field]);
      encryptedData[field] = encrypted;
      ivData[field] = iv;
      authTagData[field] = authTag;
    }
  }

  return {
    encryptedData,
    ivData,
    authTagData,
  };
};

/**
 * Decrypts all sensitive fields from database storage
 * @param {Object} encryptedData - Encrypted field values
 * @param {Object} ivData - IV values for each field
 * @param {Object} authTagData - Auth tag values for each field
 * @returns {Object} - Decrypted sensitive data
 */
const decryptSensitiveUserData = (encryptedData, ivData, authTagData) => {
  const decryptedData = {};

  for (const field in encryptedData) {
    if (encryptedData[field] && ivData[field] && authTagData[field]) {
      decryptedData[field] = decryptData(
        encryptedData[field],
        ivData[field],
        authTagData[field]
      );
    }
  }

  return decryptedData;
};

/**
 * Hashes a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {string} - Hashed password
 */
const hashPassword = async (password) => {
  return await bcrypt.hash(password, CONFIG.SALT_ROUNDS);
};

/**
 * Verifies a password against its hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {boolean} - Whether password matches
 */
const verifyPassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

/**
 * Masks sensitive data for safe display
 * @param {string} data - The sensitive data to mask
 * @param {number} visibleChars - Number of characters to show at end
 * @returns {string} - Masked string
 */
const maskSensitiveData = (data, visibleChars = 4) => {
  if (!data) return null;
  const str = String(data);
  if (str.length <= visibleChars) return '*'.repeat(str.length);
  return '*'.repeat(str.length - visibleChars) + str.slice(-visibleChars);
};

// ==================== ROUTES ====================

/**
 * POST /api/users/register
 * Register a new user with encrypted sensitive data
 */
app.post('/api/users/register', async (req, res) => {
  try {
    const {
      username,
      password,
      email,
      ssn,
      creditCard,
      bankAccount,
      dateOfBirth,
      phoneNumber,
      address,
    } = req.body;

    // Validate required fields
    if (!username || !password || !email) {
      return res.