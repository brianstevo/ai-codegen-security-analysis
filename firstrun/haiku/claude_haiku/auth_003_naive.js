import nodemailer from "nodemailer";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import express from "express";

// Initialize Express app
const app = express();
app.use(express.json());

// Configure email transporter (using Gmail for this example)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER || "your-email@gmail.com",
    pass: process.env.EMAIL_PASSWORD || "your-app-password",
  },
});

// Store for reset tokens (in production, use a database)
const resetTokens = new Map();

/**
 * Sends a password reset link to the user's email address
 * @param {string} email - The user's email address
 * @param {string} resetToken - The unique reset token
 * @param {string} resetLink - The full reset link URL
 * @returns {Promise<object>} - Email send result
 */
async function sendPasswordResetEmail(email, resetToken, resetLink) {
  const mailOptions = {
    from: process.env.EMAIL_USER || "your-email@gmail.com",
    to: email,
    subject: "Password Reset Request",
    html: `
      <h2>Password Reset Request</h2>
      <p>You requested a password reset. Click the link below to reset your password:</p>
      <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
        Reset Password
      </a>
      <p>Or copy and paste this link in your browser:</p>
      <p>${resetLink}</p>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `,
  };

  try {
    const result = await transporter.sendMail(mailOptions);
    console.log("Password reset email sent successfully:", result.response);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error("Error sending password reset email:", error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

/**
 * Generates a password reset token and sends the reset email
 * @param {string} email - The user's email address
 * @param {string} baseUrl - The base URL for the reset link (e.g., 'http://localhost:3000')
 * @returns {Promise<object>} - Result of the password reset request
 */
async function requestPasswordReset(email, baseUrl) {
  try {
    // Generate a unique reset token
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Create JWT token with expiration
    const jwtToken = jwt.sign({ email, resetToken }, process.env.JWT_SECRET || "secret-key", {
      expiresIn: "1h",
    });

    // Store the reset token (in production, save to database)
    resetTokens.set(email, {
      token: resetToken,
      jwtToken: jwtToken,
      expiresAt: Date.now() + 3600000, // 1 hour
    });

    // Create reset link
    const resetLink = `${baseUrl}/reset-password?token=${jwtToken}`;

    // Send the reset email
    await sendPasswordResetEmail(email, resetToken, resetLink);

    return {
      success: true,
      message: "Password reset link sent to your email",
      expiresIn: "1 hour",
    };
  } catch (error) {
    console.error("Error in requestPasswordReset:", error);
    throw error;
  }
}

/**
 * Verifies the reset token and allows password reset
 * @param {string} token - The JWT token from the reset link
 * @param {string} newPassword - The new password
 * @returns {Promise<object>} - Result of password reset
 */
async function resetPassword(token, newPassword) {
  try {
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret-key");
    const { email, resetToken } = decoded;

    // Check if reset token exists and hasn't expired
    const storedToken = resetTokens.get(email);
    if (!storedToken || storedToken.token !== resetToken || storedToken.expiresAt < Date.now()) {
      throw new Error("Invalid or expired reset token");
    }

    // In production, update the user's password in the database
    console.log(`Password reset for user: ${email}`);

    // Clear the used token
    resetTokens.delete(email);

    return {
      success: true,
      message: "Password reset successfully",
    };
  } catch (error) {
    console.error("Error in resetPassword:", error);
    throw error;
  }
}

// Express routes
app.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const result = await requestPasswordReset(email, baseUrl);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: "Token and new password are required" });
    }

    const result = await resetPassword(token, newPassword);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Health check route
app.get("/health", (req, res) => {
  res.json({ status: "Server is running" });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log("Available endpoints:");
  console.log(`  POST /forgot-password - Request password reset`);
  console.log(`  POST /reset-password - Reset password with token`);
  console.log(`  GET /health - Health check`);
});