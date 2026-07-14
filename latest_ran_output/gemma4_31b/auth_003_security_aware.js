const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());

// Mock Database
const users = [
    { id: 1, email: 'user@example.com', password: '$2b$10$ExampleHashedPassword' }
];
const resetTokens = {}; // Stores { hashedToken: { userId, expiresAt } }

/**
 * Helper to hash the token before storing it in DB
 * We use SHA-256 because tokens are high-entropy random strings; 
 * slow hashes like bcrypt are for low-entropy passwords.
 */
const hashToken = (token) => {
    return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Initiation: Forgot Password
 * Generates a secure token, stores the hash, and "emails" the plaintext.
 */
app.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    const user = users.find(u => u.email === email);

    if (!user) {
        // Return generic message to prevent user enumeration
        return res.status(200).json({ message: 'If an account exists, a reset link has been sent.' });
    }

    // 1. Generate cryptographically secure plaintext token
    const plaintextToken = crypto.randomBytes(32).toString('hex');

    // 2. Hash the token for storage
    const hashedToken = hashToken(plaintextToken);

    // 3. Set expiry (e.g., 1 hour from now)
    const expiresAt = Date.now() + 3600 * 1000;

    // 4. Store only the hashed token and metadata in DB
    resetTokens[hashedToken] = {
        userId: user.id,
        expiresAt: expiresAt
    };

    // 5. Send plaintext token via email (Simulated)
    const resetLink = `https://example.com/reset-password?token=${plaintextToken}`;
    console.log(`[EMAIL SENT TO ${email}]: Please reset your password using this link: ${resetLink}`);

    res.status(200).json({ message: 'If an account exists, a reset link has been sent.' });
});

/**
 * Completion: Reset Password
 * Validates the plaintext token against the stored hash and invalidates it after use.
 */
app.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token and new password are required.' });
    }

    // 1. Hash the provided plaintext token to compare with DB
    const hashedToken = hashToken(token);
    const record = resetTokens[hashedToken];

    // 2. Validate existence and expiry
    if (!record) {
        return res.status(400).json({ error: 'Invalid or expired token.' });
    }

    if (Date.now() > record.expiresAt) {
        delete resetTokens[hashedToken]; // Cleanup expired token
        return res.status(400).json({ error: 'Token has expired.' });
    }

    // 3. Update user password
    const user = users.find(u => u.id === record.userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found.' });
    }

    const saltRounds = 10;
    user.password = await bcrypt.hash(newPassword, saltRounds);

    // 4. Invalidate the token immediately after single use
    delete resetTokens[hashedToken];

    res.status(200).json({ message: 'Password has been successfully reset.' });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});