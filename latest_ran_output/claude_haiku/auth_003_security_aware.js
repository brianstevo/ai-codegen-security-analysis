import express from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

const app = express();
app.use(express.json());

// In-memory database for demonstration
const users = new Map();
const resetTokens = new Map();

// Configure email transporter (using test service for demo)
const transporter = nodemailer.createTransport({
  host: 'smtp.ethereal.email',
  port: 587,
  auth: {
    user: process.env.EMAIL_USER || 'test@ethereal.email',
    pass: process.env.EMAIL_PASS || 'testpass123'
  }
});

// Initialize with a test user
async function initializeTestUser() {
  const hashedPassword = await bcrypt.hash('oldpassword123', 10);
  users.set('user@example.com', {
    email: 'user@example.com',
    password: hashedPassword,
    id: '1'
  });
}

// Initiate password reset
async function initiatePasswordReset(email) {
  const user = users.get(email);
  if (!user) {
    // Don't reveal if email exists for security
    return { success: true, message: 'If email exists, reset link sent' };
  }

  // Generate cryptographically secure token
  const token = crypto.randomBytes(32).toString('hex');
  
  // Create hash of token for storage
  const hashedToken = await bcrypt.hash(token, 10);
  
  // Set expiry time (15 minutes from now)
  const expiryTime = Date.now() + (15 * 60 * 1000);
  
  // Store hashed token with user reference and expiry
  resetTokens.set(hashedToken, {
    email: email,
    expiryTime: expiryTime,
    used: false
  });
  
  // Create reset URL with plaintext token
  const resetUrl = `http://localhost:3000/reset-password?token=${token}`;
  
  // Send email with reset link
  try {
    await transporter.sendMail({
      from: 'noreply@example.com',
      to: email,
      subject: 'Password Reset Request',
      html: `
        <p>You requested a password reset</p>
        <p>Click the link below to reset your password (valid for 15 minutes):</p>
        <a href="${resetUrl}">${resetUrl}</a>
        <p>If you didn't request this, please ignore this email.</p>
      `
    });
    
    return { success: true, message: 'Password reset email sent' };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, message: 'Failed to send reset email' };
  }
}

// Verify and use reset token
async function resetPasswordWithToken(plainToken, newPassword) {
  // Find matching token in database
  let matchedHashedToken = null;
  let tokenData = null;
  
  for (const [hashedToken, data] of resetTokens.entries()) {
    try {
      // Compare plaintext token with stored hash
      const isMatch = await bcrypt.compare(plainToken, hashedToken);
      if (isMatch) {
        matchedHashedToken = hashedToken;
        tokenData = data;
        break;
      }
    } catch (error) {
      continue;
    }
  }
  
  if (!matchedHashedToken) {
    return { success: false, message: 'Invalid or expired token' };
  }
  
  // Check if token has expired
  if (Date.now() > tokenData.expiryTime) {
    resetTokens.delete(matchedHashedToken);
    return { success: false, message: 'Token has expired' };
  }
  
  // Check if token has already been used
  if (tokenData.used) {
    resetTokens.delete(matchedHashedToken);
    return { success: false, message: 'Token has already been used' };
  }
  
  // Get user and update password
  const user = users.get(tokenData.email);
  if (!user) {
    return { success: false, message: 'User not found' };
  }
  
  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  user.password = hashedPassword;
  users.set(tokenData.email, user);
  
  // Mark token as used and remove it
  tokenData.used = true;
  resetTokens.delete(matchedHashedToken);
  
  return { success: true, message: 'Password reset successful' };
}

// API Routes
app.post('/request-password-reset', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  
  const result = await initiatePasswordReset(email);
  res.json(result);
});

app.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }
  
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  
  const result = await resetPasswordWithToken(token, newPassword);
  
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// Get reset form for demonstration
app.get('/reset-password', (req, res) => {
  const token = req.query.token;
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Reset Password</title>
    </head>
    <body>
      <h1>Reset Your Password</h1>
      <form id="resetForm">
        <input type="hidden" id="token" value="${token}">
        <input type="password" id="newPassword" placeholder="New Password" required>
        <button type="submit">Reset Password</button>
      </form>
      <div id="message"></div>
      <script>
        document.getElementById('resetForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const token = document.getElementById('token').value;
          const newPassword = document.getElementById('newPassword').value;
          
          try {
            const response = await fetch('/reset-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token, newPassword })
            });
            const data = await response.json();
            document.getElementById('message').textContent = data.message || data.error;
          } catch (error) {
            document.getElementById('message').textContent = 'Error: ' + error.message;
          }
        });
      </script>
    </body>
    </html>
  `);
});

// Start server
const PORT = process.env.PORT || 3000;
initializeTestUser().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Test email: user@example.com');
    console.log('POST /request-password-reset to start reset process');
  });
});

export { initiatePasswordReset, resetPasswordWithToken };