import nodemailer from "nodemailer";
import crypto from "crypto";
import jwt from "jsonwebtoken";

// Configure your email service
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: parseInt(process.env.EMAIL_PORT || "587"),
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Generate a secure reset token
function generateResetToken(userId, expiresIn = "1h") {
  const secret = process.env.JWT_SECRET || "your-secret-key";
  return jwt.sign({ userId, type: "password_reset" }, secret, {
    expiresIn,
  });
}

// Send password reset email
async function sendPasswordResetEmail(userEmail, userId) {
  try {
    // Generate reset token
    const resetToken = generateResetToken(userId);

    // Create reset link
    const resetLink = `${process.env.APP_URL || "http://localhost:3000"}/reset-password?token=${resetToken}`;

    // Email content
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: userEmail,
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
        <p>If you didn't request this reset, please ignore this email.</p>
      `,
      text: `Password Reset Request\n\nClick the link to reset your password: ${resetLink}\n\nThis link will expire in 1 hour.`,
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);

    console.log("Password reset email sent:", info.messageId);
    return {
      success: true,
      messageId: info.messageId,
      resetToken, // Return token for testing purposes (in production, don't return this)
    };
  } catch (error) {
    console.error("Error sending password reset email:", error);
    throw new Error("Failed to send password reset email");
  }
}

// Verify reset token
function verifyResetToken(token) {
  try {
    const secret = process.env.JWT_SECRET || "your-secret-key";
    const decoded = jwt.verify(token, secret);

    if (decoded.type !== "password_reset") {
      throw new Error("Invalid token type");
    }

    return {
      valid: true,
      userId: decoded.userId,
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
    };
  }
}

// Express route example
import express from "express";

const app = express();
app.use(express.json());

// Request password reset
app.post("/api/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // In a real app, you would look up the user by email
    // const user = await User.findOne({ email });
    // if (!user) {
    //   return res.status(404).json({ error: "User not found" });
    // }

    // For demonstration, using a dummy userId
    const userId = "user123";

    const result = await sendPasswordResetEmail(email, userId);

    res.json({
      success: true,
      message: "Password reset email sent",
      // Don't send token in production response
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to send password reset email",
      details: error.message,
    });
  }
});

// Verify token and reset password
app.post("/api/reset-password", (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res
        .status(400)
        .json({ error: "Token and new password are required" });
    }

    // Verify token
    const verification = verifyResetToken(token);

    if (!verification.valid) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // In a real app, you would hash the password and update the user
    // const hashedPassword = await bcrypt.hash(newPassword, 10);
    // await User.findByIdAndUpdate(verification.userId, { password: hashedPassword });

    res.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to reset password",
      details: error.message,
    });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { sendPasswordResetEmail, verifyResetToken, generateResetToken };