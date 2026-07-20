const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");

const app = express();
app.use(express.json());

const {
  MONGODB_URI = "mongodb://127.0.0.1:27017/password_reset_demo",
  APP_BASE_URL = "http://localhost:3000",
  RESET_TOKEN_SECRET = "change-this-long-random-server-secret",
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM = "no-reply@example.com",
} = process.env;

mongoose.connect(MONGODB_URI);

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    resetPasswordTokenHash: {
      type: String,
      default: null,
      index: true,
    },
    resetPasswordTokenExpiresAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

const mailer = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT || 587),
  secure: Number(SMTP_PORT) === 465,
  auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
});

function generateResetToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function hashResetToken(plaintextToken) {
  return crypto
    .createHmac("sha256", RESET_TOKEN_SECRET)
    .update(plaintextToken)
    .digest("hex");
}

async function sendPasswordResetEmail({ to, resetUrl, expiresInMinutes }) {
  await mailer.sendMail({
    from: MAIL_FROM,
    to,
    subject: "Reset your password",
    text: `Use this link to reset your password. It expires in ${expiresInMinutes} minutes:\n\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
    html: `
      <p>Use this link to reset your password. It expires in ${expiresInMinutes} minutes:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>If you did not request this, ignore this email.</p>
    `,
  });
}

async function initiatePasswordReset(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    return;
  }

  const plaintextToken = generateResetToken();
  const tokenHash = hashResetToken(plaintextToken);
  const expiresInMinutes = 30;
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  user.resetPasswordTokenHash = tokenHash;
  user.resetPasswordTokenExpiresAt = expiresAt;
  await user.save();

  const resetUrl = `${APP_BASE_URL}/reset-password?token=${encodeURIComponent(
    plaintextToken
  )}`;

  await sendPasswordResetEmail({
    to: user.email,
    resetUrl,
    expiresInMinutes,
  });
}

async function resetPasswordWithToken(plaintextToken, newPassword) {
  if (!plaintextToken || typeof plaintextToken !== "string") {
    throw new Error("Invalid or expired reset token");
  }

  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 12) {
    throw new Error("Password must be at least 12 characters");
  }

  const tokenHash = hashResetToken(plaintextToken);
  const passwordHash = await bcrypt.hash(newPassword, 12);

  const updatedUser = await User.findOneAndUpdate(
    {
      resetPasswordTokenHash: tokenHash,
      resetPasswordTokenExpiresAt: { $gt: new Date() },
    },
    {
      $set: {
        passwordHash,
        resetPasswordTokenHash: null,
        resetPasswordTokenExpiresAt: null,
      },
    },
    {
      new: true,
    }
  );

  if (!updatedUser) {
    throw new Error("Invalid or expired reset token");
  }

  return updatedUser;
}

app.post("/password-reset", async (req, res, next) => {
  try {
    await initiatePasswordReset(req.body.email);

    res.status(202).json({
      message:
        "If an account with that email exists, a password reset link has been sent.",
    });
  } catch (err) {
    next(err);
  }
});

app.post("/password-reset/confirm", async (req, res, next) => {
  try {
    await resetPasswordWithToken(req.body.token, req.body.newPassword);

    res.json({
      message: "Password has been reset.",
    });
  } catch (err) {
    res.status(400).json({
      message: err.message || "Unable to reset password",
    });
  }
});

app.use((err, req, res, next) => {
  res.status(500).json({ message: "Internal server error" });
});

module.exports = {
  app,
  User,
  initiatePasswordReset,
  resetPasswordWithToken,
};

if (require.main === module) {
  app.listen(process.env.PORT || 3000);
}