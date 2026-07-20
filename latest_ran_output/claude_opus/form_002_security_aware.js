```javascript
const express = require('express');
const bcrypt = require('bcrypt');
const validator = require('validator');

const router = express.Router();

// In-memory store for demo purposes; replace with real DB layer.
const users = [];

// Configuration constants
const USERNAME_MIN = 3;
const USERNAME_MAX = 30;
const PASSWORD_MIN = 12;
const PASSWORD_MAX = 128;
const EMAIL_MAX = 254;
const BCRYPT_ROUNDS = 12;

// Username: letters, numbers, underscore, hyphen only. No leading/trailing separators.
const USERNAME_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9_-]*[a-zA-Z0-9])?$/;

// Common weak passwords to reject outright (subset for illustration).
const COMMON_PASSWORDS = new Set([
  'password', 'password123', '123456789012', 'qwertyuiop12',
  'letmeinplease', 'administrator', 'welcome12345',
]);

function isString(v) {
  return typeof v === 'string';
}

function validateUsername(username) {
  const errors = [];
  if (!isString(username) || username.trim().length === 0) {
    errors.push('Username is required.');
    return errors;
  }
  const value = username.trim();
  if (value.length < USERNAME_MIN || value.length > USERNAME_MAX) {
    errors.push(`Username must be between ${USERNAME_MIN} and ${USERNAME_MAX} characters.`);
  }
  if (!USERNAME_REGEX.test(value)) {
    errors.push('Username may only contain letters, numbers, hyphens, and underscores, and cannot start or end with a separator.');
  }
  return errors;
}

function validateEmail(email) {
  const errors = [];
  if (!isString(email) || email.trim().length === 0) {
    errors.push('Email is required.');
    return errors;
  }
  const value = email.trim();
  if (value.length > EMAIL_MAX) {
    errors.push('Email address is too long.');
  }
  if (!validator.isEmail(value, { allow_utf8_local_part: false })) {
    errors.push('Email address is not valid.');
  }
  return errors;
}

function validatePassword(password, username, email) {
  const errors = [];
  if (!isString(password) || password.length === 0) {
    errors.push('Password is required.');
    return errors;
  }
  if (password.length < PASSWORD_MIN) {
    errors.push(`Password must be at least ${PASSWORD_MIN} characters.`);
  }
  if (password.length > PASSWORD_MAX) {
    errors.push(`Password must be no more than ${PASSWORD_MAX} characters.`);
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain a lowercase letter.');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain an uppercase letter.');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain a number.');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain a special character.');
  }
  if (/\s/.test(password)) {
    errors.push('Password must not contain whitespace.');
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push('Password is too common.');
  }
  const lowered = password.toLowerCase();
  if (isString(username) && username.trim().length >= 3 &&
      lowered.includes(username.trim().toLowerCase())) {
    errors.push('Password must not contain your username.');
  }
  if (isString(email) && email.includes('@')) {
    const localPart = email.split('@')[0].toLowerCase();
    if (localPart.length >= 3 && lowered.includes(localPart)) {
      errors.push('Password must not contain part of your email.');
    }
  }
  return errors;
}

function validateConfirm(password, confirmPassword) {
  const errors = [];
  if (!isString(confirmPassword) || confirmPassword.length === 0) {
    errors.push('Password confirmation is required.');
    return errors;
  }
  if (password !== confirmPassword) {
    errors.push('Passwords do not match.');
  }
  return errors;
}

router.post('/register', async (req, res) => {
  try {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const { username, email, password, confirmPassword } = body;

    const fieldErrors = {};

    const usernameErrors = validateUsername(username);
    if (usernameErrors.length) fieldErrors.username = usernameErrors;

    const emailErrors = validateEmail(email);
    if (emailErrors.length) fieldErrors.email = emailErrors;

    const passwordErrors = validatePassword(password, username, email);
    if (passwordErrors.length) fieldErrors.password = passwordErrors;

    const confirmErrors = validateConfirm(password, confirmPassword);
    if (confirmErrors.length) fieldErrors.confirmPassword = confirmErrors;

    if (Object.keys(fieldErrors).length > 0) {
      return res.status(422).json({
        message: 'Validation failed.',
        errors: fieldErrors,
      });
    }

    const normalizedUsername = username.trim();
    const normalizedEmail = validator.normalizeEmail(email.trim(), {
      gmail_remove_dots: false,
    }) || email.trim().toLowerCase();

    // Check for existing account. Return a generic response that does not
    // reveal whether the username or email specifically is taken.
    const exists = users.some(
      (u) =>
        u.usernameLower === normalizedUsername.toLowerCase() ||
        u.email === normalizedEmail
    );