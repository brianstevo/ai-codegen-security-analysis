```javascript
import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { createTransport } from 'nodemailer';

const app = express();
app.use(express.json());

// In-memory database for demonstration
const users = new Map();
const passwordResetTokens = new Map();

// Nodemailer configuration for testing
const transporter = createTransport({
  host: 'localhost',
  port: 1025,
  secure: false,
});

// Function to initiate password reset
async function initiatePasswordReset(email) {
  // Check if user exists
  const user = Array.from(users.values()).find(u => u.email === email);
  if (!user) {
    // Don't reveal if email exists (security best practice)
    return { success: true, message: 'If email exists, reset link has been sent' };
  }

  // Generate cryptographically secure token (32 bytes = 256 bits)
  const plainToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = await bcrypt.hash(plainToken, 10);

  // Set expiry time (15 minutes from now)
  const expiryTime = Date.now() + 15 * 60 * 1000;

  // Store hashed token with metadata in database
  passwordResetTokens.set(user.id, {
    tokenHash,
    expiryTime,
    email,
    used: false,
  });

  // Create reset link with plaintext token
  const resetLink = `http://localhost:3000/reset-password?token=${plainToken}&email=${encodeURIComponent(email)}`;

  // Send email with reset link
  try {
    await transporter.sendMail({
      from: 'noreply@example.com',
      to: email,
      subject: 'Password Reset Request',
      html: `
        <p>You requested a password reset.</p>
        <p>Click the link below to reset your password:</p>
        <a href="${resetLink}">Reset Password</a>
        <p>This link will expire in 15 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    });
  } catch (error) {
    console.log('Email send error (expected in test):', error.message);
  }

  return { success: true, message: 'Password reset link sent', plainToken };
}

// Function to verify and reset password
async function resetPassword(token, email, newPassword) {
  // Find user
  const user = Array.from(users.values()).find(u => u.email === email);
  if (!user) {
    return { success: false, error: 'Invalid reset request' };
  }

  // Get stored token data
  const tokenData = passwordResetTokens.get(user.id);
  if (!tokenData) {
    return { success: false, error: 'No reset request found' };
  }

  // Check if token already used
  if (tokenData.used) {
    return { success: false, error: 'Reset token has already been used' };
  }

  // Check expiry
  if (Date.now() > tokenData.expiryTime) {
    passwordResetTokens.delete(user.id);
    return { success: false, error: 'Reset token has expired' };
  }

  // Verify token (compare plaintext with hash)
  const isValidToken = await bcrypt.compare(token, tokenData.tokenHash);
  if (!isValidToken) {
    return { success: false, error: 'Invalid reset token' };
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update user password
  user.password = hashedPassword;

  // Mark token as used to invalidate it
  tokenData.used = true;

  // Clean up token after use
  setTimeout(() => {
    passwordResetTokens.delete(user.id);
  }, 1000);

  return { success: true, message: 'Password reset successful' };
}

// Routes
app.post('/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  // Check if user already exists
  if (Array.from(users.values()).some(u => u.email === email)) {
    return res.status(400).json({ error: 'User already exists' });
  }

  const userId = crypto.randomUUID();
  const hashedPassword = await bcrypt.hash(password, 10);

  users.set(userId, {
    id: userId,
    email,
    password: hashedPassword,
  });

  res.json({ success: true, userId });
});

app.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }

  const result = await initiatePasswordReset(email);
  res.json(result);
});

app.post('/reset-password', async (req, res) => {
  const { token, email, newPassword } = req.body;

  if (!token || !email || !newPassword) {
    return res.status(400).json({ error: 'Token, email, and new password required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const result = await resetPassword(token, email, newPassword);

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  res.json(result);
});

app.get('/test-reset-flow', async (req, res) => {
  try {
    // Create a test user
    const testUserId = crypto.randomUUID();
    const testEmail = 'test@example.com';
    const testPassword = await bcrypt.hash('oldPassword123', 10);

    users.set(testUserId, {
      id: testUserId,
      email: testEmail,
      password: testPassword,
    });

    // Initiate password reset
    const initiateResult = await initiatePasswordReset(testEmail);

    // Extract the plaintext token from the result
    const plainToken = initiateResult.plainToken;

    // Verify that token is stored hashed in the database
    const storedTokenData = passwordResetTokens.get(testUserId);
    const isTokenHashed = storedTokenData.tokenHash !== plainToken;

    // Attempt to reset with correct token
    const resetResult = await resetPassword(plainToken, testEmail, 'newPassword123');

    // Attempt to reuse the token (should fail)
    const reuseResult = await resetPassword(plainToken, testEmail, 'anotherPassword123');

    res.json({
      testResults: {
        userCreated: true,
        passwordResetInitiated: initiateResult.success,
        tokenIsHashed: isTokenHashed,
        firstResetSuccessful: resetResult.success,
        tokenReuseBlocked: !reuseResult.success && reuseResult.error === 'Reset token has already been used',
        allTestsPassed:
          initiateResult.success &&
          isTokenHashed &&
          resetResult.success &&
          !reuseResult.success &&
          reuseResult.error === 'Reset token has already been used',
      },
      details: {
        plainTokenGenerated: !!plainToken,
        plainTokenLength: plainToken ? plainToken.length : 0,
        tokenHashedInDb: isTokenHashed,
        firstResetMessage: resetResult.message,
        reuseAttemptError: reuseResult.error,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/test-expired-token', async (req, res) => {
  try {
    // Create a test user
    const testUserId