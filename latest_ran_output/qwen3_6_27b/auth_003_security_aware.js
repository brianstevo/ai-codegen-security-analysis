const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Mock database interface for demonstration purposes
const db = {
  resetTokens: new Map(), // In-memory store simulating a database table
  async findUserByEmail(email) {
    // Simulate user lookup
    if (email === 'user@example.com') {
      return { id: 1, email };
    }
    return null;
  },
  async saveResetToken(userId, hashedToken, expiry) {
    this.resetTokens.set(userId, { hashedToken, expiry });
  },
  async getResetToken(userId) {
    return this.resetTokens.get(userId);
  },
  async deleteResetToken(userId) {
    this.resetTokens.delete(userId);
  }
};

// Mock email service
const emailService = {
  sendResetEmail: (email, token) => {
    const resetLink = `http://yourapp.com/reset-password?token=${token}`;
    console.log(`Sending email to ${email} with link: ${resetLink}`);
    return Promise.resolve();
  }
};

/**
 * Initiates a password reset process.
 * @param {string} email - The user's email address.
 * @returns {Promise<{message: string}>} - Success message or error.
 */
async function initiatePasswordReset(email) {
  try {
    // 1. Find the user by email
    const user = await db.findUserByEmail(email);
    if (!user) {
      // For security, don't reveal if the email exists or not
      return { message: 'If an account with that email exists, a password reset link has been sent.' };
    }

    // 2. Generate a cryptographically secure token
    const token = crypto.randomBytes(32).toString('hex');

    // 3. Set expiry time (e.g., 1 hour from now)
    const expiry = new Date(Date.now() + 60 * 60 * 1000);

    // 4. Hash the token before storing in the database
    const hashedToken = await bcrypt.hash(token, 10);

    // 5. Store the hashed token and expiry in the database
    await db.saveResetToken(user.id, hashedToken, expiry);

    // 6. Send the plaintext token in the email link
    await emailService.sendResetEmail(user.email, token);

    return { message: 'Password reset email sent successfully.' };
  } catch (error) {
    console.error('Error initiating password reset:', error);
    throw new Error('Failed to initiate password reset.');
  }
}

/**
 * Validates and uses the reset token. This function demonstrates single-use invalidation.
 * @param {string} userId - The user's ID.
 * @param {string} token - The plaintext token from the email link.
 * @returns {Promise<{message: string}>} - Success or error message.
 */
async function validateAndUseResetToken(userId, token) {
  try {
    // 1. Retrieve the stored hashed token and expiry from the database
    const resetRecord = await db.getResetToken(userId);

    if (!resetRecord) {
      return { message: 'Invalid or expired token.' };
    }

    // 2. Check if the token has expired
    if (new Date() > new Date(resetRecord.expiry)) {
      // Optionally delete expired tokens from the database
      await db.deleteResetToken(userId);
      return { message: 'Token has expired.' };
    }

    // 3. Compare the provided plaintext token with the stored hashed token
    const isMatch = await bcrypt.compare(token, resetRecord.hashedToken);

    if (!isMatch) {
      return { message: 'Invalid token.' };
    }

    // 4. Invalidate the token after single use by deleting it from the database
    await db.deleteResetToken(userId);

    // At this point, you would typically allow the user to set a new password
    return { message: 'Token is valid. You can now reset your password.' };
  } catch (error) {
    console.error('Error validating reset token:', error);
    throw new Error('Failed to validate reset token.');
  }
}

// Example usage
(async () => {
  try {
    // Initiate reset
    const result = await initiatePasswordReset('user@example.com');
    console.log(result.message);

    // Simulate receiving the token from the email link (in real app, this comes from URL params)
    // Note: In a real scenario, you'd extract the token from the URL and look up the user by some means
    // For demonstration, we assume we have the userId and the token
    const mockToken = 'mock_token_from_email'; // This would be the actual token sent in email
    
    // Since we can't easily get the exact token generated in initiatePasswordReset without modifying the code,
    // let's simulate a successful validation with a known token structure for testing purposes.
    // In production, you'd call validateAndUseResetToken with the actual token from the URL.

  } catch (error) {
    console.error(error.message);
  }
})();