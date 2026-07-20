```javascript
const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

// Mock database - replace with your actual database
const users = new Map();
const passwordResetTokens = new Map();

// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Generate a secure password reset token
 * @returns {string} - A secure random token
 */
const generateResetToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

/**
 * Send password reset email to user
 * @param {string} email - User's email address
 * @param {string} resetToken - The password reset token
 * @param {string} resetUrl - The full reset URL
 */
const sendResetEmail = async (email, resetToken, resetUrl) => {
  const mailOptions = {
    from: `"Support Team" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Password Reset Request",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>You have requested to reset your password. Click the button below to reset it:</p>
        <a 
          href="${resetUrl}" 
          style="
            display: inline-block;
            padding: 12px 24px;
            background-color: #007bff;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            margin: 16px 0;
          "
        >
          Reset Password
        </a>
        <p>Or copy and paste this link into your browser:</p>
        <p style="color: #666; word-break: break-all;">${resetUrl}</p>
        <p><strong>This link will expire in 1 hour.</strong></p>
        <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
        <p style="color: #999; font-size: 12px;">
          This is an automated email. Please do not reply to this email.
        </p>
      </div>
    `,
    text: `
      Password Reset Request
      
      You have requested to reset your password.
      
      Click the following link to reset your password:
      ${resetUrl}
      
      This link will expire in 1 hour.
      
      If you did not request a password reset, please ignore this email.
    `,
  };

  await transporter.sendMail(mailOptions);
};

/**
 * POST /auth/forgot-password
 * Send password reset link to user's email
 */
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email input
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email address is required.",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find user by email - replace with your actual database query
    const user = users.get(normalizedEmail);

    // Always return success to prevent email enumeration attacks
    // Even if the user doesn't exist, we return the same response
    if (!user) {
      return res.status(200).json({
        success: true,
        message:
          "If an account with that email exists, a password reset link has been sent.",
      });
    }

    // Generate a secure reset token
    const resetToken = generateResetToken();

    // Hash the token before storing it
    const hashedToken = await bcrypt.hash(resetToken, 10);

    // Set token expiration (1 hour from now)
    const tokenExpiration = Date.now() + 3600000; // 1 hour in milliseconds

    // Store the hashed token with expiration - replace with your actual database storage
    passwordResetTokens.set(normalizedEmail, {
      token: hashedToken,
      expiration: tokenExpiration,
      userId: user.id,
    });

    // Build the reset URL
    const baseUrl = process.env.CLIENT_BASE_URL || "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(normalizedEmail)}`;

    // Send the reset email
    await sendResetEmail(normalizedEmail, resetToken, resetUrl);

    return res.status(200).json({
      success: true,
      message:
        "If an account with that email exists, a password reset link has been sent.",
    });
  } catch (error) {
    console.error("Error in forgot-password route:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while processing your request.",
    });
  }
});

/**
 * POST /auth/reset-password
 * Reset user's password using the token
 */
router.post("/reset-password", async (req, res) => {
  try {
    const { token, email, newPassword } = req.body;

    // Validate inputs
    if (!token || !email || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Token, email, and new password are required.",
      });
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Retrieve stored token data - replace with your actual database query
    const tokenData = passwordResetTokens.get(normalizedEmail);

    if (!tokenData) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired password reset token.",
      });
    }

    // Check if token has expired
    if (Date.now() > tokenData.expiration) {
      passwordResetTokens.delete(normalizedEmail);
      return res.status(400).json({
        success: false,
        message: "Password reset token has expired. Please request a new one.",
      });
    }

    // Verify the token
    const isValidToken = await bcrypt.compare(token, tokenData.token);
    if (!isValidToken) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired password reset token.",
      });
    }

    // Find user - replace with your actual database query
    const user = users.get(normalizedEmail);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not found.",
      });
    }

    // Hash the new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update user's password - replace with your actual database update
    user.password = hashedPassword;
    users.set(normalizedEmail, user);

    // Remove used reset token
    passwordResetTokens.delete(normalizedEmail);

    // Optionally send a confirmation email
    const confirmationMailOptions = {
      from: `"