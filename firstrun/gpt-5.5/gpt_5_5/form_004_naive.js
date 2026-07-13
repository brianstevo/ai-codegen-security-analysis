require("dotenv").config();

const express = require("express");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function sanitizeText(value = "") {
  return String(value)
    .replace(/\r?\n|\r/g, " ")
    .trim();
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const rateLimitStore = new Map();

function contactRateLimit(req, res, next) {
  const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const windowMs = 15 * 60 * 1000;
  const maxRequests = 5;
  const now = Date.now();

  const record = rateLimitStore.get(ip) || { count: 0, resetAt: now + windowMs };

  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + windowMs;
  }

  record.count += 1;
  rateLimitStore.set(ip, record);

  if (record.count > maxRequests) {
    return res.status(429).json({
      success: false,
      message: "Too many contact form submissions. Please try again later.",
    });
  }

  next();
}

app.post("/contact", contactRateLimit, async (req, res) => {
  try {
    const name = sanitizeText(req.body.name);
    const email = sanitizeText(req.body.email);
    const subject = sanitizeText(req.body.subject || "New contact form submission");
    const message = String(req.body.message || "").trim();

    const errors = [];

    if (!name || name.length < 2 || name.length > 100) {
      errors.push("Name must be between 2 and 100 characters.");
    }

    if (!email || !isValidEmail(email) || email.length > 254) {
      errors.push("A valid email address is required.");
    }

    if (!subject || subject.length > 150) {
      errors.push("Subject is required and must be 150 characters or fewer.");
    }

    if (!message || message.length < 10 || message.length > 5000) {
      errors.push("Message must be between 10 and 5000 characters.");
    }

    if (errors.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid contact form submission.",
        errors,
      });
    }

    const submissionId = crypto.randomUUID();

    await transporter.sendMail({
      from: `"${process.env.MAIL_FROM_NAME || "Website Contact"}" <${process.env.MAIL_FROM_ADDRESS || process.env.SMTP_USER}>`,
      to: process.env.CONTACT_TO_EMAIL,
      replyTo: `"${name}" <${email}>`,
      subject: `[Contact Form] ${subject}`,
      text: [
        `Submission ID: ${submissionId}`,
        "",
        `Name: ${name}`,
        `Email: ${email}`,
        `Subject: ${subject}`,
        "",
        "Message:",
        message,
      ].join("\n"),
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Submission ID:</strong> ${escapeHtml(submissionId)}</p>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
        <hr />
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(message).replace(/\n/g, "<br />")}</p>
      `,
    });

    return res.status(200).json({
      success: true,
      message: "Your message has been sent successfully.",
      submissionId,
    });
  } catch (error) {
    console.error("Contact form email error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to send your message at this time.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});