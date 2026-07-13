const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());

/**
 * MOCK DATABASE
 * In a real application, use MongoDB, PostgreSQL, etc.
 */
const db = {
    users: [
        { id: 1, email: 'user@example.com', passwordHash: '$2b$10$ExampleHash...', resetTokenHash: null, resetTokenExpires: null }
    ],
    async findUserByEmail(email) {
        return this.users.find(u => u.email === email);
    },
    async findUserByResetToken(hash) {
        return this.users.find(u => u.resetTokenHash === hash);
    },
    async updateUser(userId, updates) {
        const user = this.users.find(u => u.id === userId);
        if (user) Object.assign(user, updates);
        return user;
    }
};

/**
 * MOCK EMAIL SERVICE
 */
const emailService = {
    sendResetEmail: async (email, token) => {
        const resetLink = `https://api.example.com/reset-password?token=${token}`;
        console.log(`[EMAIL SENT to ${email}]: Please reset your password using this link: ${resetLink}`);
        return true;
    }
};

/**
 * 1. INITIATE PASSWORD RESET
 * Generates a secure token, stores the hash, and sends plaintext via email.
 */
app.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await db.findUserByEmail(email);

        if (!user) {
            // Return generic message to prevent user enumeration
            return res.status(200).json({ message: 'If an account exists with that email, a reset link has been sent.' });
        }

        // Generate a cryptographically secure random token (plaintext)
        const resetToken = crypto.randomBytes(32).toString('hex');

        // Hash the token before storing it in the database
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

        // Set expiry time (e.g., 1 hour from now)
        const expires = new Date(Date.now() + 3600000);

        await db.updateUser(user.id, {
            resetTokenHash: hashedToken,
            resetTokenExpires: expires
        });

        // Send the plaintext token to the user via email
        await emailService.sendResetEmail(user.email, resetToken);

        res.status(200).json({ message: 'If an account exists with that email, a reset link has been sent.' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * 2. COMPLETE PASSWORD RESET
 * Validates the token hash and expiry, updates password, then invalidates the token.
 */
app.post('/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        // Hash the provided plaintext token to compare with stored hash
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        const user = await db.findUserByResetToken(hashedToken);

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired reset token.' });
        }

        // Check if the token has expired
        if (new Date() > user.resetTokenExpires) {
            // Clear expired token from DB
            await db.updateUser(user.id, { resetTokenHash: null, resetTokenExpires: null });
            return res.status(400).json({ error: 'Reset token has expired.' });
        }

        // Hash the new password
        const saltRounds = 10;
        const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update password and IMMEDIATELY invalidate the token (single-use)
        await db.updateUser(user.id, {
            passwordHash: hashedNewPassword,
            resetTokenHash: null, 
            resetTokenExpires: null
        });

        res.status(200).json({ message: 'Password has been successfully reset.' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));