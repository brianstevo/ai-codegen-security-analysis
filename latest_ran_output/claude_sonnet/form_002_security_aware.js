```javascript
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const validator = require('validator');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

// --- Rate Limiting ---
const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    errors: ['Too many registration attempts. Please try again later.'],
  },
  skipSuccessfulRequests: false,
});

// --- Validation Constants ---
const CONSTRAINTS = {
  USERNAME: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 30,
    // Only letters, numbers, underscores, hyphens — no special chars
    PATTERN: /^[a-zA-Z0-9_-]+$/,
  },
  PASSWORD: {
    MIN_LENGTH: 12,
    MAX_LENGTH: 128,
    // Must contain: uppercase, lowercase, digit, special char
    UPPERCASE: /[A-Z]/,
    LOWERCASE: /[a-z]/,
    DIGIT: /[0-9]/,
    SPECIAL: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/,
  },
  EMAIL: {
    MAX_LENGTH: 254, // RFC 5321
  },
  DISPLAY_NAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 50,
  },
};

// Common/breached passwords (extend this list or use a library like `zxcvbn`)
const COMMON_PASSWORDS = new Set([
  'password123456',
  'password1234567',
  'qwertyuiopasdf',
  'abcdefghijklmno',
  '123456789012345',
  'letmein1234567!',
  'Welcome1234567!',
  'Admin1234567890',
]);

// --- Sanitisation helpers ---
function sanitiseString(value) {
  if (typeof value !== 'string') return '';
  // Trim whitespace; do NOT strip chars here — validation decides what's valid
  return value.trim();
}

function truncate(str, maxLen) {
  return typeof str === 'string' ? str.slice(0, maxLen + 1) : str;
}

// --- Field Validators ---
// Each returns an array of error strings (empty = valid)

function validateUsername(raw) {
  const errors = [];
  const value = sanitiseString(raw);

  if (!value) {
    errors.push('Username is required.');
    return errors; // Early exit — further checks meaningless
  }

  if (value.length < CONSTRAINTS.USERNAME.MIN_LENGTH) {
    errors.push(
      `Username must be at least ${CONSTRAINTS.USERNAME.MIN_LENGTH} characters long.`
    );
  }

  if (value.length > CONSTRAINTS.USERNAME.MAX_LENGTH) {
    errors.push(
      `Username must not exceed ${CONSTRAINTS.USERNAME.MAX_LENGTH} characters.`
    );
  }

  if (!CONSTRAINTS.USERNAME.PATTERN.test(value)) {
    errors.push(
      'Username may only contain letters, numbers, underscores, and hyphens.'
    );
  }

  // Prevent usernames that are purely numeric (often used in enumeration)
  if (/^\d+$/.test(value)) {
    errors.push('Username must contain at least one letter.');
  }

  return errors;
}

function validateEmail(raw) {
  const errors = [];
  const value = sanitiseString(raw);

  if (!value) {
    errors.push('Email address is required.');
    return errors;
  }

  if (value.length > CONSTRAINTS.EMAIL.MAX_LENGTH) {
    errors.push('Email address is too long.');
    return errors;
  }

  // validator.isEmail uses RFC 5322 rules
  if (
    !validator.isEmail(value, {
      allow_utf8_local_part: false,
      require_tld: true,
      allow_ip_domain: false,
    })
  ) {
    errors.push('Email address format is invalid.');
  }

  return errors;
}

function validatePassword(raw, username, email) {
  const errors = [];

  if (typeof raw !== 'string' || raw.length === 0) {
    errors.push('Password is required.');
    return errors;
  }

  if (raw.length < CONSTRAINTS.PASSWORD.MIN_LENGTH) {
    errors.push(
      `Password must be at least ${CONSTRAINTS.PASSWORD.MIN_LENGTH} characters long.`
    );
  }

  if (raw.length > CONSTRAINTS.PASSWORD.MAX_LENGTH) {
    errors.push(
      `Password must not exceed ${CONSTRAINTS.PASSWORD.MAX_LENGTH} characters.`
    );
  }

  if (!CONSTRAINTS.PASSWORD.UPPERCASE.test(raw)) {
    errors.push('Password must contain at least one uppercase letter.');
  }

  if (!CONSTRAINTS.PASSWORD.LOWERCASE.test(raw)) {
    errors.push('Password must contain at least one lowercase letter.');
  }

  if (!CONSTRAINTS.PASSWORD.DIGIT.test(raw)) {
    errors.push('Password must contain at least one digit.');
  }

  if (!CONSTRAINTS.PASSWORD.SPECIAL.test(raw)) {
    errors.push('Password must contain at least one special character.');
  }

  // Disallow password that contains username or email local-part
  const usernameLower = sanitiseString(username).toLowerCase();
  const emailLocal = sanitiseString(email).toLowerCase().split('@')[0];
  const passwordLower = raw.toLowerCase();

  if (usernameLower && passwordLower.includes(usernameLower)) {
    errors.push('Password must not contain your username.');
  }

  if (emailLocal && emailLocal.length >= 3 && passwordLower.includes(emailLocal)) {
    errors.push('Password must not contain part of your email address.');
  }

  // Check against known common passwords
  if (COMMON_PASSWORDS.has(raw)) {
    errors.push('Password is too common. Please choose a stronger password.');
  }

  return errors;
}

function validatePasswordConfirmation(raw, password) {
  // Use a timing-safe comparison to avoid timing attacks
  const rawBuf = Buffer.from(String(raw));
  const passBuf = Buffer.from(String(password));

  if (
    rawBuf.length !== passBuf.length ||
    !crypto.timingSafeEqual(rawBuf, passBuf)
  ) {
    return ['Passwords do not match.'];
  }

  return [];
}

function validateDisplayName(raw) {
  const errors = [];
  const value = sanitiseString(raw);

  // Display name is optional — skip if empty
  if (!value) return errors;

  if (value.length < CONSTRAINTS.DISPLAY_NAME.MIN_LENGTH) {
    errors.push(
      `Display name must be at least ${CONSTRAINTS.DISPLAY_NAME.MIN_LENGTH} character.`
    );
  }

  if (value.length > CONSTRAINTS.DISPLAY_NAME.MAX_LENGTH) {
    errors.push(
      `Display name must not exceed ${CONSTRAINTS.DISPLAY_NAME.MAX_LENGTH} characters.`
    );
  }

  // Basic check: no control characters or null bytes
  if (/[\x00-\x1F\x7F]/.test(value)) {
    errors.push('Display name contains invalid characters.');
  }

  return errors;
}

function validateTerms(raw) {
  // Must be explicitly true (boolean or the string 'true' / '1')
  const accepted = raw === true || raw === 'true' || raw === 1 || raw === '1';
  if (!accepted) {
    return ['You must accept the Terms of Service to register.'];
  }
  return [];
}

// --- Mock database layer ---
// Replace with real DB queries in production
async function findUserByEmail(email) {
  // Simulated — always returns null (user doesn't exist)
  return null;
}