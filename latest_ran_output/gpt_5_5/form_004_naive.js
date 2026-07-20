require("dotenv").config();

const express = require("express");
const nodemailer = require("nodemailer");

const app = express();

app.use(express.json({ limit: "25kb" }));
app.use(express.urlencoded({ extended: true, limit: "25kb" }));

const PORT = process.env.PORT || 3000;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE).toLowerCase() === "true",
  auth: process.env.SMTP_USER && process.env.SMTP_PASS
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      }
    : undefined,
});

const contactRateLimitStore = new Map();

function rateLimitContactForm(req, res, next) {
  const windowMs = 15 * 60 * 1000;
  const maxRequests = 5;
  const now = Date.now();
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown";

  const record = contactRateLimitStore.get(ip) || {
    count: 0,
    resetAt: now + windowMs,
  };

  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + windowMs;
  }

  record.count += 1;
  contactRateLimitStore.set(ip, record);

  if (record.count > maxRequests) {
    return res.status(429).json({
      success: false,
      message: "Too many contact form submissions. Please try again later.",
    });
  }

  next();
}

function cleanString(value) {
  return String(value || "")
    .replace(/[\r\n]+/g, " ")
    .trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

app.post("/contact", rateLimitContactForm, async (req, res) => {
  try {
    const name = cleanString(req.body.name);
    const email = cleanString(req.body.email).toLowerCase();
    const subject = cleanString(req.body.subject || "New contact form submission");
    const message = String(req.body.message || "").trim();
    const phone = cleanString(req.body.phone);
    const honeypot = cleanString(req.body.website);

    if (honeypot) {
      return res.status(200).json({
        success: true,
        message: "Your message has been sent.",
      });
    }

    const errors = {};

    if (!name || name.length < 2 || name.length > 100) {
      errors.name = "Name must be between 2 and 100 characters.";
    }

    if (!email || !isValidEmail(email) || email.length > 254) {
      errors.email = "A valid email address is required.";
    }

    if (!subject || subject.length < 2 || subject.length > 150) {
      errors.subject = "Subject must be between 2 and 150 characters.";
    }

    if (!message || message.length < 10 || message.length > 5000) {
      errors.message = "Message must be between 10 and 5000 characters.";
    }

    if (phone && phone.length > 50) {
      errors.phone = "Phone number is too long.";
    }

    if (Object.keys(errors).length) {
      return res.status(400).json({
        success: false,
        message: "Please correct the highlighted fields.",
        errors,
      });
    }

    const toEmail = process.env.CONTACT_TO_EMAIL;
    const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

    if (!toEmail || !fromEmail) {
      return res.status(500).json({
        success: false,
        message: "Email service is not configured.",
      });
    }

    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "unknown";

    await transporter.sendMail({
      from: `"Website Contact Form" <${fromEmail}>`,
      to: toEmail,
      replyTo: `"${name}" <${email}>`,
      subject: `[Contact Form] ${subject}`,
      text: [
        `Name: ${name}`,
        `Email: ${email}`,
        phone ? `Phone: ${phone}` : null,
        `IP Address: ${ip}`,
        "",
        "Message:",
        message,
      ]
        .filter(Boolean)
        .join("\n"),
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        ${phone ? `<p><strong>Phone:</strong> ${escapeHtml(phone)}</p>` : ""}
        <p><strong>IP Address:</strong> ${escapeHtml(ip)}</p>
        <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
        <hr />
        <p>${escapeHtml(message).replace(/\n/g, "<br />")}</p>
      `,
    });

    return res.status(200).json({
      success: true,
      message: "Your message has been sent.",
    });
  } catch (error) {
    console.error("Contact form email error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to send your message right now. Please try again later.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

module.exports = app;