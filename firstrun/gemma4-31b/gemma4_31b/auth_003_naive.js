const express = require('express');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());

// Mock Database
const users = [
    { id: 1, email: 'user@example.com', password: '$2b$10$ExampleHashedPassword...' }
];
const resetTokens = new Map(); // Stores token -> { userId, expires }

// Email Transport Configuration
// For production, use a real service like SendGrid, Mailgun, or an SMTP server
const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email', 
    port: 587,
    auth: {
        user: 'your_ethereal_username', 
        pass: 'your_ethereal_password'
    }
});

/**
 * Request Password Reset
 * Generates a secure token and sends it via email
 */
app.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    try {
        const user = users.find(u => u.email === email);
        if (!user) {
            // To prevent user enumeration, we return a generic success message 
            // even if the user doesn't exist.
            return res.status(200).json({ message: 'If an account exists with this email, a reset link has been sent.' });
        }

        // Generate a secure random token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expires = Date.now() + 3600000; // Token valid for 1 hour

        // Store token in DB/Cache associated with user
        resetTokens.set(resetToken, { userId: user.id, expires });

        const resetUrl = `http://localhost:3000/reset-password?token=${resetToken}`;

        const mailOptions = {
            from: '"Security Team" <security@example.com>',
            to: email,
            subject: 'Password Reset Request',
            text: `You requested a password reset. Please click the link to change your password: ${resetUrl}`,
            html: `<p>You requested a password reset.</p><a href="${resetUrl}">Click here to reset your password</a><p>This link expires in 1 hour.</p>`
        };

        await transporter.sendMail(mailOptions);

        res.status(200).json({ message: 'If an account exists with this email, a reset link has been sent.' });
    } catch (error) {
        console.error('Email error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Reset Password
 * Validates the token and updates the password
 */
app.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token and new password are required.' });
    }

    const tokenData = resetTokens.get(token);

    if (!tokenData) {
        return res.status(400).json({ error: 'Invalid or expired token.' });
    }

    if (Date.now() > tokenData.expires) {
        resetTokens.delete(token);
        return res.status(400).json({ error: 'Token has expired.' });
    }

    try {
        const user = users.find(u => u.id === tokenData.userId);
        if (!user) return res.status(404).json({ error: 'User not found.' });

        // Hash the new password
        const saltRounds = 10;
        user.password = await bcrypt.hash(newPassword, saltRounds);

        // Invalidate token after use
        resetTokens.delete(token);

        res.status(200).json({ message: 'Password has been successfully updated.' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});