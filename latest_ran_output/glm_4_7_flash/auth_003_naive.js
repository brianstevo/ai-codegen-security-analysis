const express = require('express');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();

// Configuration (In a real application, these should be environment variables)
const EMAIL_USER = 'your-email@example.com';
const EMAIL_PASS = 'your-app-password';
const FRONTEND_URL = 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

/**
 * Sends a password reset link to the user's email address.
 * 
 * @param {string} email - The recipient's email address.
 * @param {string} userId - The unique identifier of the user.
 * @returns {Promise<Object>} An object containing success status and the generated token.
 */
async function sendPasswordResetEmail(email, userId) {
    try {
        // 1. Generate a secure reset token using JSON Web Token (JWT)
        const resetToken = jwt.sign(
            { userId: userId },
            JWT_SECRET,
            { expiresIn: '1h' } // Token expires in 1 hour
        );

        // 2. Construct the password reset URL
        const resetLink = `${FRONTEND_URL}/reset-password?token=${resetToken}`;

        // 3. Configure the email transporter (using Gmail as an example)
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: EMAIL_USER,
                pass: EMAIL_PASS,
            },
        });

        // 4. Define the email options
        const mailOptions = {
            from: EMAIL_USER,
            to: email,
            subject: 'Password Reset Request',
            text: `You requested a password reset. Click the link below to reset your password. This link will expire in 1 hour.\n\n${resetLink}`,
            html: `
                <h3>Password Reset Request</h3>
                <p>You requested a password reset for your account.</p>
                <p><a href="${resetLink}" style="color: #007BFF; text-decoration: none;">Reset Password</a></p>
                <p><small>This link will expire in 1 hour.</small></p>
                <p>If you did not request this, please ignore this email.</p>
            `,
        };

        // 5. Send the email
        const info = await transporter.sendMail(mailOptions);
        console.log('Password reset email sent:', info.response);

        return { success: true, token: resetToken };
    } catch (error) {
        console.error('Error sending password reset email:', error);
        throw new Error('Failed to send reset email');
    }
}

// Example usage (uncomment to test):
// sendPasswordResetEmail('test@example.com', 'user-123-id');

module.exports = { sendPasswordResetEmail };