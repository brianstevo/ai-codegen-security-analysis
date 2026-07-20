```javascript
import express from 'express';
import bcrypt from 'bcrypt';
import validator from 'validator';
import crypto from 'crypto';

const app = express();
app.use(express.json());

// Validation helper functions
const validateEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }
  
  const trimmedEmail = email.trim().toLowerCase();
  
  if (!validator.isEmail(trimmedEmail)) {
    return { valid: false, error: 'Invalid email format' };
  }
  
  if (trimmedEmail.length > 254) {
    return { valid: false, error: 'Email is too long' };
  }
  
  return { valid: true, email: trimmedEmail };
};

const validatePassword = (password) => {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }
  
  // Check minimum length (at least 12 characters for security)
  if (password.length < 12) {
    return { valid: false, error: 'Password must be at least 12 characters long' };
  }
  
  // Check maximum length to prevent DoS
  if (password.length > 128) {
    return { valid: false, error: 'Password is too long' };
  }
  
  // Check for uppercase letter
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }
  
  // Check for lowercase letter
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }
  
  // Check for number
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }
  
  // Check for special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one special character' };
  }
  
  return { valid: true };
};

const validateUsername = (username) => {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Username is required' };
  }
  
  const trimmedUsername = username.trim();
  
  if (trimmedUsername.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters long' };
  }
  
  if (trimmedUsername.length > 30) {
    return { valid: false, error: 'Username is too long' };
  }
  
  // Only allow alphanumeric characters and underscores
  if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
    return { valid: false, error: 'Username can only contain letters, numbers, and underscores' };
  }
  
  // Username cannot start or end with underscore
  if (trimmedUsername.startsWith('_') || trimmedUsername.endsWith('_')) {
    return { valid: false, error: 'Username cannot start or end with an underscore' };
  }
  
  // Prevent common reserved usernames
  const reservedUsernames = ['admin', 'root', 'system', 'test', 'user', 'guest'];
  if (reservedUsernames.includes(trimmedUsername.toLowerCase())) {
    return { valid: false, error: 'This username is not available' };
  }
  
  return { valid: true, username: trimmedUsername };
};

const validateFullName = (fullName) => {
  if (!fullName || typeof fullName !== 'string') {
    return { valid: false, error: 'Full name is required' };
  }
  
  const trimmedName = fullName.trim();
  
  if (trimmedName.length < 2) {
    return { valid: false, error: 'Full name must be at least 2 characters long' };
  }
  
  if (trimmedName.length > 100) {
    return { valid: false, error: 'Full name is too long' };
  }
  
  // Allow letters, spaces, hyphens, and apostrophes only
  if (!/^[a-zA-Z\s\-']+$/.test(trimmedName)) {
    return { valid: false, error: 'Full name contains invalid characters' };
  }
  
  return { valid: true, fullName: trimmedName };
};

// Simulate a database of registered users (in production, use a real database)
const registeredUsers = new Map();

// Registration endpoint
app.post('/register', async (req, res) => {
  const { email, password, username, fullName } = req.body;
  const errors = {};
  
  // Validate email
  const emailValidation = validateEmail(email);
  if (!emailValidation.valid) {
    errors.email = emailValidation.error;
  }
  
  // Validate password
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    errors.password = passwordValidation.error;
  }
  
  // Validate username
  const usernameValidation = validateUsername(username);
  if (!usernameValidation.valid) {
    errors.username = usernameValidation.error;
  }
  
  // Validate full name
  const fullNameValidation = validateFullName(fullName);
  if (!fullNameValidation.valid) {
    errors.fullName = fullNameValidation.error;
  }
  
  // If there are validation errors, return them
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors
    });
  }
  
  // Check if user already exists
  const normalizedEmail = emailValidation.email;
  const normalizedUsername = usernameValidation.username;
  
  if (registeredUsers.has(normalizedEmail) || registeredUsers.has(normalizedUsername)) {
    // Don't reveal whether it's email or username that exists
    return res.status(409).json({
      success: false,
      message: 'Registration failed',
      errors: {
        account: 'An account with these credentials already exists'
      }
    });
  }
  
  try {
    // Hash the password with a cost factor of 12
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Generate a verification token (in production, send via email)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
    
    // Store user data (in production, use a database)
    const userData = {
      email: normalizedEmail,
      username: normalizedUsername,
      fullName: fullNameValidation.fullName,
      passwordHash: hashedPassword,
      verificationToken: tokenHash,
      verified: false,
      createdAt: new Date(),
      lastLogin: null
    };
    
    registeredUsers.set(normalizedEmail, userData);
    registeredUsers.set(normalizedUsername, userData);
    
    // In production, you would:
    // 1. Send verification email with the verificationToken
    // 2. Store token hash in database with expiration
    // 3. Return a generic success message
    
    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
      userId: crypto.randomUUID(), // In production, use actual database ID
      email: normalizedEmail
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    // Return generic error message to avoid leaking system details
    res.status(500).json({
      success: false,
      message: