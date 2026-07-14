const express = require('express');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());

// Configuration (In production, use environment variables)
const JWT_SECRET = 'your_super_secret_key';
const RESET_TOKEN_EXPIRY = '1h'; 
const EMAIL_CONFIG = {
    service: 'Gmail', // e.g., 'Gmail' or a custom SMTP transport
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
};

// Mock Database
const users = [
    { 
        id: 1, 
        email: 'user@example.com', 
        password: await bcrypt.hash('Password123!', 10) 
    }
];

/**
 * Sends a password reset link to the user's email address
 */
app.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }

    try {
        // 1. Check if user exists in the database
        const user = users.find(u => u.email === email);
        if (!user) {
            // For security, don't reveal if the email exists or not
            return res.status(200).json({ message: 'If an account with this email exists, a reset link has been sent.' });
        }

        // 2. Generate a secure, time-limited JWT token
        const resetToken = jwt.sign(
            { userId: user.id }, 
            JWT_SECRET, 
            { expiresIn: RESET_TOKEN_EXPIRY }
        );

        // 3. Construct the reset URL
        const resetUrl = `http://localhost:3000/reset-password/${resetToken}`;

        // 4. Configure Nodemailer transporter
        const transporter = nodemailer.createTransport(EMAIL_CONFIG);

        // 5. Send the email
        await transporter.sendMail({
            from: '"Password Recovery" <noreply@yourdomain.com>',
            to: user.email,
            subject: 'Password Reset Request',
            text: `You requested a password reset. Please click the link below to set a new password. This link expires in 1 hour:\n\n${resetUrl}`,
            html: `<p>You requested a password reset. Please click the link below to set a new password.</p>
                   <p>This link expires in 1 hour:</p>
                   <a href="${resetUrl}">Reset Password</a>`,
        });

        return res.status(200).json({ message: 'Password reset email sent successfully.' });
    } catch (error) {
        console.error('Error sending reset email:', error);
        return res.status(500).json({ message: 'Internal server error occurred while sending the email.' });
    }
});

/**
 * Endpoint to handle the actual password update using the token
 */
app.post('/reset-password/:token', async (req, res) => {
    const { token } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
        return res.status(400).json({ message: 'New password is required' });
    }

    try {
        // 1. Verify the JWT token
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // 2. Find user by ID from token payload
        const user = users.find(u => u.id === decoded.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // 3. Hash new password and update database
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;

        return res.status(200).json({ message: 'Password has been successfully updated.' });
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Reset link has expired' });
        }
        return res.status(400).json({ message: 'Invalid or corrupted reset token' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});