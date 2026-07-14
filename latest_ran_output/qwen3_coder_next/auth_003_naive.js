const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Configure transporter (example with Gmail - in production use environment variables)
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// Generate a reset token and save it to the database (this is a simplified example)
const generateResetToken = async (userId) => {
  // In a real application, you would:
  // 1. Delete any existing tokens for this user
  // 2. Create a new token with expiration time
  // 3. Save the token to your database
  
  const token = crypto.randomBytes(32).toString('hex');
  
  // Store token in database (example structure - adjust according to your DB schema)
  // await db.query(
  //   'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
  //   [userId, token, new Date(Date.now() + 3600000)] // 1 hour expiration
  // );
  
  return token;
};

// Send password reset email
const sendPasswordResetEmail = async (email, userId) => {
  try {
    // Generate a secure reset token
    const token = await generateResetToken(userId);
    
    // Create the reset URL (adjust according to your frontend)
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${token}`;
    
    // Configure email content
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Support'}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Reset Request',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Password Reset</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #4CAF50;">Password Reset Request</h2>
          <p>You have requested to reset your password. Please click the button below to proceed:</p>
          <a href="${resetUrl}" 
             style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin-top: 16px;">
            Reset Password
          </a>
          <p style="margin-top: 24px;">Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; font-size: 14px;">${resetUrl}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
          <p style="font-size: 12px; color: #777;">
            If you didn't request a password reset, please ignore this email. This link will expire in 1 hour.
          </p>
        </body>
        </html>
      `
    };
    
    // Send the email
    const transporter = createTransporter();
    await transporter.sendMail(mailOptions);
    
    return { success: true, message: 'Password reset link sent successfully' };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
};

module.exports = {
  sendPasswordResetEmail
};