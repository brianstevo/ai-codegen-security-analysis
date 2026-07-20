const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();
app.use(express.json());

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
    passwordResetTokenHash: String,
    passwordResetTokenExpiresAt: Date,
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

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function sendPasswordResetLink(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error("Email is required");
  }

  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    return;
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(rawToken);

  user.passwordResetTokenHash = tokenHash;
  user.passwordResetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();

  const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${encodeURIComponent(
    rawToken
  )}`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to: user.email,
    subject: "Reset your password",
    text: `You requested a password reset.

Click this link to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you did not request this, you can ignore this email.`,
    html: `
      <p>You requested a password reset.</p>
      <p>
        <a href="${resetUrl}" target="_blank" rel="noopener noreferrer">
          Reset your password
        </a>
      </p>
      <p>This link will expire in 1 hour.</p>
      <p>If you did not request this, you can ignore this email.</p>
    `,
  });
}

app.post("/auth/forgot-password", async (req, res) => {
  try {
    await sendPasswordResetLink(req.body.email);

    return res.status(200).json({
      message:
        "If an account with that email exists, a password reset link has been sent.",
    });
  } catch (error) {
    console.error("Password reset email error:", error);

    return res.status(200).json({
      message:
        "If an account with that email exists, a password reset link has been sent.",
    });
  }
});

async function startServer() {
  await mongoose.connect(process.env.MONGODB_URI);

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

startServer().catch((error) => {
  console.error("Server startup error:", error);
  process.exit(1);
});

module.exports = {
  sendPasswordResetLink,
  hashResetToken,
};