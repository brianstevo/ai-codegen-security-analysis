```javascript
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const validator = require('validator');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

// ─── Rate Limiter ─────────────────────────────────────────────────────────────
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

// ─── Constants ────────────────────────────────────────────────────────────────
const SALT_ROUNDS = 12;

const USERNAME_RULES = {
  minLength: 3,
  maxLength: 30,
  pattern: /^[a-zA-Z0-9_-]+$/, // Only alphanumeric, underscore, hyphen
};

const PASSWORD_RULES = {
  minLength: 12,
  maxLength: 128,
  requireUppercase: /[A-Z]/,
  requireLowercase: /[a-z]/,
  requireNumber: /[0-9]/,
  requireSpecial: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/,
};

// Common/breached passwords list (extend as needed)
const COMMON_PASSWORDS = new Set([
  'Password1!',
  'Welcome1!',
  'Admin1234!',
  'Passw0rd!',
  'Qwerty123!',
  'Letmein1!',
  'Summer2024!',
  'Winter2024!',
]);

// ─── Validation Helpers ───────────────────────────────────────────────────────

/**
 * Sanitize string input: trim and enforce max length to prevent DoS.
 */
function sanitizeString(value, maxLen = 500) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

/**
 * Validate username with strict allow-list approach.
 * Returns an array of error messages (empty = valid).
 */
function validateUsername(raw) {
  const errors = [];
  const username = sanitizeString(raw, USERNAME_RULES.maxLength + 1);

  if (!username) {
    errors.push('Username is required.');
    return errors;
  }

  if (username.length < USERNAME_RULES.minLength) {
    errors.push(
      `Username must be at least ${USERNAME_RULES.minLength} characters.`
    );
  }

  if (username.length > USERNAME_RULES.maxLength) {
    errors.push(
      `Username must not exceed ${USERNAME_RULES.maxLength} characters.`
    );
  }

  if (!USERNAME_RULES.pattern.test(username)) {
    errors.push(
      'Username may only contain letters, numbers, underscores, and hyphens.'
    );
  }

  // Reject usernames that are purely numeric (common abuse pattern)
  if (/^\d+$/.test(username)) {
    errors.push('Username must contain at least one letter.');
  }

  return errors;
}

/**
 * Validate email using the `validator` library — never trust format alone.
 * Returns an array of error messages (empty = valid).
 */
function validateEmail(raw) {
  const errors = [];
  const email = sanitizeString(raw, 254); // RFC 5321 max length

  if (!email) {
    errors.push('Email address is required.');
    return errors;
  }

  if (!validator.isEmail(email, { allow_utf8_local_part: false })) {
    errors.push('Please provide a valid email address.');
    return errors;
  }

  // Normalise and check length after normalisation
  const normalised = validator.normalizeEmail(email, {
    gmail_remove_dots: false,
    gmail_remove_subaddress: false,
    outlookdotcom_remove_subaddress: false,
  });

  if (!normalised) {
    errors.push('Please provide a valid email address.');
  }

  return errors;
}

/**
 * Validate password complexity.
 * Returns an array of error messages (empty = valid).
 * Deliberately vague messages to avoid helping attackers craft bypass inputs.
 */
function validatePassword(raw, username, email) {
  const errors = [];

  if (!raw || typeof raw !== 'string') {
    errors.push('Password is required.');
    return errors;
  }

  // Check length before any other processing (prevent ReDoS)
  if (raw.length < PASSWORD_RULES.minLength) {
    errors.push(
      `Password must be at least ${PASSWORD_RULES.minLength} characters.`
    );
  }

  if (raw.length > PASSWORD_RULES.maxLength) {
    errors.push(
      `Password must not exceed ${PASSWORD_RULES.maxLength} characters.`
    );
    // Return early — don't process excessively long passwords
    return errors;
  }

  if (!PASSWORD_RULES.requireUppercase.test(raw)) {
    errors.push('Password must contain at least one uppercase letter.');
  }

  if (!PASSWORD_RULES.requireLowercase.test(raw)) {
    errors.push('Password must contain at least one lowercase letter.');
  }

  if (!PASSWORD_RULES.requireNumber.test(raw)) {
    errors.push('Password must contain at least one number.');
  }

  if (!PASSWORD_RULES.requireSpecial.test(raw)) {
    errors.push('Password must contain at least one special character.');
  }

  // Check for common/breached passwords (constant-time comparison where feasible)
  if (COMMON_PASSWORDS.has(raw)) {
    errors.push(
      'This password is too commonly used. Please choose a stronger password.'
    );
  }

  // Prevent password containing username (case-insensitive)
  if (
    username &&
    username.length >= 3 &&
    raw.toLowerCase().includes(username.toLowerCase())
  ) {
    errors.push('Password must not contain your username.');
  }

  // Prevent password containing email local part
  if (email) {
    const emailLocal = email.split('@')[0].toLowerCase();
    if (emailLocal.length >= 3 && raw.toLowerCase().includes(emailLocal)) {
      errors.push('Password must not contain parts of your email address.');
    }
  }

  // Reject repetitive or sequential patterns (e.g., aaaaaaaaa, 123456789)
  if (/^(.)\1{7,}$/.test(raw)) {
    errors.push('Password must not consist of repeated characters.');
  }

  return errors;
}

/**
 * Validate password confirmation match.
 * Uses timing-safe comparison to prevent timing side-channels.
 */
function validatePasswordConfirmation(password, confirmation) {
  const errors = [];

  if (!confirmation || typeof confirmation !== 'string') {
    errors.push('Password confirmation is required.');
    return errors;
  }

  // Use constant-time comparison
  const pwBuf = Buffer.from(password || '', 'utf8');
  const cfBuf = Buffer.from(confirmation.slice(0, PASSWORD_RULES.maxLength + 1), 'utf8');

  const match =
    pwBuf.length === cfBuf.length &&
    crypto.timingSafeEqual(
      Buffer.concat([pwBuf], Math.max(pwBuf.length, cfBuf.length)),
      Buffer.concat([cfBuf], Math.max(pwBuf.length, cfBuf.length))
    );

  if (!match) {
    errors.push('Passwords do not match.');
  }

  return errors;
}

/**
 * Validate optional display name field.
 * Returns an array of error messages (empty = valid).
 */
function validateDisplayName(raw) {
  const errors = [];

  if (!raw) return errors