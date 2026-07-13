const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// Mock database for demonstration
const users = new Map();

/**
 * Stores a user's password in the database with proper hashing and security
 * @param {string} userId - The unique identifier for the user
 * @param {string} plainPassword - The plain text password to hash and store
 * @returns {Promise<{success: boolean, message: string, hashedPassword?: string}>}
 */
async function storeUserPassword(userId, plainPassword) {
  try {
    // Validate inputs
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid user ID provided');
    }

    if (!plainPassword || typeof plainPassword !== 'string') {
      throw new Error('Invalid password provided');
    }

    if (plainPassword.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    // Generate a salt and hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);

    // Generate a unique token for password reset capability
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Store in database (in this example, using Map as mock database)
    users.set(userId, {
      hashedPassword,
      resetTokenHash,
      createdAt: new Date(),
      lastPasswordChange: new Date(),
    });

    return {
      success: true,
      message: 'Password stored successfully',
      hashedPassword, // Return hashed version for verification
    };
  } catch (error) {
    return {
      success: false,
      message: `Error storing password: ${error.message}`,
    };
  }
}

/**
 * Verifies a user's password against the stored hash
 * @param {string} userId - The unique identifier for the user
 * @param {string} plainPassword - The plain text password to verify
 * @returns {Promise<boolean>}
 */
async function verifyUserPassword(userId, plainPassword) {
  try {
    const user = users.get(userId);

    if (!user) {
      return false;
    }

    const isMatch = await bcrypt.compare(
      plainPassword,
      user.hashedPassword
    );
    return isMatch;
  } catch (error) {
    console.error('Error verifying password:', error);
    return false;
  }
}

/**
 * Updates a user's password
 * @param {string} userId - The unique identifier for the user
 * @param {string} oldPassword - The current password for verification
 * @param {string} newPassword - The new password to set
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function updateUserPassword(userId, oldPassword, newPassword) {
  try {
    // Verify old password
    const isValidOldPassword = await verifyUserPassword(userId, oldPassword);

    if (!isValidOldPassword) {
      return {
        success: false,
        message: 'Current password is incorrect',
      };
    }

    if (newPassword.length < 8) {
      return {
        success: false,
        message: 'New password must be at least 8 characters long',
      };
    }

    // Hash the new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update the user record
    const user = users.get(userId);
    user.hashedPassword = hashedPassword;
    user.lastPasswordChange = new Date();

    return {
      success: true,
      message: 'Password updated successfully',
    };
  } catch (error) {
    return {
      success: false,
      message: `Error updating password: ${error.message}`,
    };
  }
}

// Express routes for demonstration
app.post('/api/auth/register', async (req, res) => {
  const { userId, password } = req.body;

  if (!userId || !password) {
    return res.status(400).json({
      success: false,
      message: 'User ID and password are required',
    });
  }

  const result = await storeUserPassword(userId, password);
  const statusCode = result.success ? 201 : 400;
  res.status(statusCode).json(result);
});

app.post('/api/auth/verify', async (req, res) => {
  const { userId, password } = req.body;

  if (!userId || !password) {
    return res.status(400).json({
      success: false,
      message: 'User ID and password are required',
    });
  }

  const isValid = await verifyUserPassword(userId, password);
  res.json({
    success: isValid,
    message: isValid ? 'Password verified' : 'Invalid credentials',
  });
});

app.post('/api/auth/change-password', async (req, res) => {
  const { userId, oldPassword, newPassword } = req.body;

  if (!userId || !oldPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'User ID, old password, and new password are required',
    });
  }

  const result = await updateUserPassword(userId, oldPassword, newPassword);
  const statusCode = result.success ? 200 : 400;
  res.status(statusCode).json(result);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// Export functions for testing
module.exports = {
  storeUserPassword,
  verifyUserPassword,
  updateUserPassword,
  app,
};