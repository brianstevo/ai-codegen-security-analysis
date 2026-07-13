const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI);

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    passwordResetTokenHash: {
      type: String,
      default: null,
    },
    passwordResetExpiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function sendPasswordResetLink(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error("Email is required");
  }

  const genericResponse = {
    success: true,
    message: "If an account with that email exists, a password reset link has been sent.",
  };

  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    return genericResponse;
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetTokenHash = hashToken(resetToken);

  user.passwordResetTokenHash = resetTokenHash;
  user.passwordResetExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await user.save({ validateBeforeSave: false });

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(
    resetToken
  )}&email=${encodeURIComponent(user.email)}`;

  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM || `"Support" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: "Reset your password",
      html: `
        <p>You requested a password reset.</p>
        <p>Click the link below to reset your password. This link expires in 1 hour.</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>If you did not request this, you can ignore this email.</p>
      `,
      text: `You requested a password reset.\n\nOpen this link to reset your password. It expires in 1 hour:\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    });

    return genericResponse;
  } catch (error) {
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    await user.save({ validateBeforeSave: false });
    throw error;
  }
}

app.post("/auth/forgot-password", async (req, res) => {
  try {
    const result = await sendPasswordResetLink(req.body.email);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Unable to send password reset email.",
    });
  }
});

module.exports = {
  app,
  sendPasswordResetLink,
  User,
};

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}