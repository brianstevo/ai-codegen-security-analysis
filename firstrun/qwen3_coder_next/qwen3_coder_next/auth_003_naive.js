const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Configure transporter (example with Gmail - in production use environment variables)
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

/**
 * Sends a password reset link to the user's email address
 * @param {string} userEmail - The email address of the user
 * @param {Function} getUserByEmail - Async function that takes email and returns user object or null
 * @param {string} baseUrl - Base URL of your application (e.g., 'https://yourapp.com')
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function sendPasswordResetLink(userEmail, getUserByEmail, baseUrl) {
  try {
    // Get user from database
    const user = await getUserByEmail(userEmail);
    
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    
    // Generate a secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Store the token (in production, save to database with expiration time)
    // For example purposes, we'll assume user object has a method or property to store this
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour from now
    
    // In real implementation, save the token to database:
    // await User.findByIdAndUpdate(user.id, { resetPasswordToken: resetToken, resetPasswordExpires: Date.now() + 3600000 });
    
    // Create reset URL
    const resetUrl = `${baseUrl}/reset-password/${resetToken}`;
    
    // Create email content
    const mailOptions = {
      from: process.env.EMAIL_FROM || '"Your App Name" <no-reply@yourapp.com>',
      to: userEmail,
      subject: 'Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset</h2>
          <p>You have requested to reset your password. Click the button below to proceed:</p>
          <a href="${resetUrl}" 
             style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Reset Password
          </a>
          <p style="margin-top: 20px;">If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all; font-size: 14px;">${resetUrl}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #666;">
            This link will expire in 1 hour.<br>
            If you didn't request a password reset, please ignore this email.
          </p>
        </div>
      `
    };
    
    // Send the email
    const transporter = createTransporter();
    await transporter.sendMail(mailOptions);
    
    return { success: true, message: 'Password reset link sent successfully' };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return { success: false, message: 'Failed to send password reset email' };
  }
}

// Example usage:
/*
const express = require('express');
const app = express();

app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
  
  // In real implementation, you would get this from your database model
  const getUserByEmail = async (email) => {
    // Example user lookup - replace with actual DB query
    return await User.findOne({ where: { email } });
  };
  
  const result = await sendPasswordResetLink(
    email,
    getUserByEmail,
    'https://yourapp.com'
  );
  
  res.json(result);
});
*/

module.exports = {
  sendPasswordResetLink
};