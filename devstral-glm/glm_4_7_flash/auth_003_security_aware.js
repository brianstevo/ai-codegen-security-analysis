const crypto = require('crypto');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

// Mock Database Connection
const dbUrl = 'mongodb://localhost:27017/auth-demo';
mongoose.connect(dbUrl);

// Define the Reset Token Schema
const ResetTokenSchema = new mongoose.Schema({
  email: { type: String, required: true, index: true },
  token: { type: String, required: true }, // Stores the HASHED token
  createdAt: { type: Date, default: Date.now, expires: 3600 }, // Auto delete after 1 hour
  used: { type: Boolean, default: false }
});

const ResetToken = mongoose.model('ResetToken', ResetTokenSchema);

// Mock Email Service
const sendEmail = async (email, resetLink) => {
  console.log(`[EMAIL SERVICE] Sending reset link to ${email}: ${resetLink}`);
  // In a real application, use nodemailer or a service like SendGrid
};

/**
 * Initiates a password reset process.
 * @param {string} email - The user's email address.
 */
const initiatePasswordReset = async (email) => {
  try {
    // 1. Generate a cryptographically secure random token (plaintext)
    const plainToken = crypto.randomBytes(32).toString('hex');

    // 2. Hash the token for secure storage in the database
    const hashedToken = await bcrypt.hash(plainToken, 10);

    // 3. Set an expiry time (e.g., 1 hour from now)
    const expiresAt = new Date(Date.now() + 3600000);

    // 4. Save only the hashed token to the database
    await ResetToken.create({
      email,
      token: hashedToken,
      expiresAt,
      used: false
    });

    // 5. Send the plaintext token in the email link
    const resetLink = `http://localhost:3000/reset-password?token=${plainToken}`;
    await sendEmail(email, resetLink);

    return { success: true, message: 'Reset link sent' };
  } catch (error) {
    console.error('Password reset initiation failed:', error);
    throw error;
  }
};

/**
 * Verifies the token and invalidates it (marks as used).
 * This function handles the "single use" requirement.
 */
const verifyResetToken = async (token) => {
  try {
    // Find the token in the database
    const resetRecord = await ResetToken.findOne({ token });

    if (!resetRecord) {
      throw new Error('Invalid or expired token');
    }

    // Check if already used
    if (resetRecord.used) {
      throw new Error('Token has already been used');
    }

    // Check expiry
    if (resetRecord.expiresAt < new Date()) {
      throw new Error('Token has expired');
    }

    // Verify the hash matches the provided token
    const isMatch = await bcrypt.compare(token, resetRecord.token);

    if (!isMatch) {
      throw new Error('Invalid token');
    }

    // Invalidate the token (mark as used)
    resetRecord.used = true;
    await resetRecord.save();

    return { success: true, message: 'Token verified' };
  } catch (error) {
    console.error('Token verification failed:', error);
    throw error;
  }
};

module.exports = { initiatePasswordReset, verifyResetToken };