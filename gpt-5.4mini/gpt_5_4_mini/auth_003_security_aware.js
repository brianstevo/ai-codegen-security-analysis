const crypto = require('crypto');
const bcrypt = require('bcrypt');
const express = require('express');

const app = express();
app.use(express.json());

// Example in-memory "database" models for demonstration.
// Replace these with your real DB models (e.g., Mongoose, Sequelize, Prisma).
const users = new Map(); // key: email, value: user object
const passwordResetTokens = new Map(); // key: userId, value: reset record

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateSecureToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function sendPasswordResetEmail(email, resetLink) {
  // Replace with your real email provider integration.
  console.log(`Sending password reset email to ${email}: ${resetLink}`);
}

async function initiatePasswordReset(email) {
  const user = users.get(email.toLowerCase());
  if (!user) {
    // Avoid account enumeration; behave as if email was accepted.
    return { message: 'If the email exists, a reset link has been sent.' };
  }

  const plaintextToken = generateSecureToken();
  const hashedToken = hashToken(plaintextToken);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes

  // Store only the hashed token in the database.
  passwordResetTokens.set(user.id, {
    userId: user.id,
    tokenHash: hashedToken,
    expiresAt,
    usedAt: null,
  });

  const resetLink = `https://example.com/reset-password?token=${encodeURIComponent(
    plaintextToken
  )}&email=${encodeURIComponent(email.toLowerCase())}`;

  await sendPasswordResetEmail(email, resetLink);

  return { message: 'If the email exists, a reset link has been sent.' };
}

async function verifyAndConsumePasswordResetToken(email, plaintextToken, newPassword) {
  const user = users.get(email.toLowerCase());
  if (!user) {
    throw new Error('Invalid or expired reset token.');
  }

  const record = passwordResetTokens.get(user.id);
  if (!record) {
    throw new Error('Invalid or expired reset token.');
  }

  if (record.usedAt) {
    throw new Error('Invalid or expired reset token.');
  }

  if (record.expiresAt.getTime() < Date.now()) {
    passwordResetTokens.delete(user.id);
    throw new Error('Invalid or expired reset token.');
  }

  const incomingHash = hashToken(plaintextToken);
  if (incomingHash !== record.tokenHash) {
    throw new Error('Invalid or expired reset token.');
  }

  // Invalidate after single use.
  record.usedAt = new Date();
  passwordResetTokens.delete(user.id);

  const passwordHash = await bcrypt.hash(newPassword, 12);
  user.passwordHash = passwordHash;

  return { message: 'Password has been reset successfully.' };
}

// Example routes
app.post('/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const result = await initiatePasswordReset(email);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Something went wrong.' });
  }
});

app.post('/auth/reset-password', async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;
    const result = await verifyAndConsumePasswordResetToken(email, token, newPassword);
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message || 'Invalid request.' });
  }
});

// Demo seed user
(async () => {
  const passwordHash = await bcrypt.hash('Password123!', 12);
  users.set('user@example.com', {
    id: 'user_1',
    email: 'user@example.com',
    passwordHash,
  });
})();

module.exports = {
  app,
  initiatePasswordReset,
  verifyAndConsumePasswordResetToken,
};