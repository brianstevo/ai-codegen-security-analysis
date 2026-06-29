```javascript
const express = require('express');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const validator = require('validator');
const DOMPurify = require('isomorphic-dompurify');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ─── Rate Limiter ────────────────────────────────────────────────────────────
// Keyed per IP: max 5 contact-form submissions per hour
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Trust proxy header only if your deployment sets it reliably;
    // otherwise fall back to socket address.
    return (
      req.headers['x-forwarded-for']?.split(',')[0].trim() ||
      req.socket.remoteAddress
    );
  },
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      error:
        'Too many contact requests from this IP address. ' +
        'Please try again after one hour.',
    });
  },
});

// ─── Nodemailer Transport ────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ─── Sanitisation Helpers ────────────────────────────────────────────────────

/**
 * Strip HTML tags and normalise whitespace from a plain-text field.
 * DOMPurify removes any injected markup; validator trims the result.
 */
function sanitisePlainText(value) {
  if (typeof value !== 'string') return '';
  const stripped = DOMPurify.sanitize(value, { ALLOWED_TAGS: [] }); // no tags allowed
  return validator.trim(stripped);
}

/**
 * Escape characters that have special meaning inside an HTML email body
 * so that sanitised text cannot break the template structure.
 */
function escapeForHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/\n/g, '<br>');
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Returns an array of error strings.  Empty array means all fields are valid.
 */
function validateContactForm({ name, email, subject, message }) {
  const errors = [];

  // Name: 2–100 chars, letters/spaces/hyphens/apostrophes only
  if (!name || name.length < 2 || name.length > 100) {
    errors.push('Name must be between 2 and 100 characters.');
  } else if (!/^[\p{L}\p{M}' \-]+$/u.test(name)) {
    errors.push('Name contains invalid characters.');
  }

  // Email
  if (!email || !validator.isEmail(email)) {
    errors.push('A valid email address is required.');
  } else if (email.length > 254) {
    errors.push('Email address is too long.');
  }

  // Subject: 3–150 chars
  if (!subject || subject.length < 3 || subject.length > 150) {
    errors.push('Subject must be between 3 and 150 characters.');
  }

  // Message: 10–3000 chars
  if (!message || message.length < 10 || message.length > 3000) {
    errors.push('Message must be between 10 and 3,000 characters.');
  }

  return errors;
}

// ─── Email Template ──────────────────────────────────────────────────────────

function buildEmailHtml({ name, email, subject, message, submittedAt, ip }) {
  const safeIp = escapeForHtml(ip);
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Contact Form Submission</title>
  <style>
    body  { margin:0; padding:0; background:#f4f4f4; font-family:Arial,sans-serif; }
    .wrap { max-width:640px; margin:32px auto; background:#fff;
            border-radius:8px; overflow:hidden;
            box-shadow:0 2px 8px rgba(0,0,0,.12); }
    .hdr  { background:#1a73e8; color:#fff; padding:24px 32px; }
    .hdr h1 { margin:0; font-size:20px; }
    .body { padding:32px; color:#333; font-size:15px; line-height:1.6; }
    .field-label { font-weight:bold; color:#555; margin-bottom:4px; }
    .field-value { margin:0 0 20px 0; padding:12px 16px;
                   background:#f9f9f9; border-left:4px solid #1a73e8;
                   border-radius:0 4px 4px 0; word-break:break-word; }
    .meta  { margin-top:24px; padding-top:16px; border-top:1px solid #eee;
             font-size:12px; color:#999; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hdr">
      <h1>📬 New Contact Form Submission</h1>
    </div>
    <div class="body">
      <p class="field-label">Name</p>
      <p class="field-value">${escapeForHtml(name)}</p>

      <p class="field-label">Email</p>
      <p class="field-value">
        <a href="mailto:${escapeForHtml(email)}" style="color:#1a73e8;">
          ${escapeForHtml(email)}
        </a>
      </p>

      <p class="field-label">Subject</p>
      <p class="field-value">${escapeForHtml(subject)}</p>

      <p class="field-label">Message</p>
      <p class="field-value">${escapeForHtml(message)}</p>

      <div class="meta">
        <p>Submitted: ${escapeForHtml(submittedAt)}</p>
        <p>Sender IP: ${safeIp}</p>
      </div>
    </div>
  </div>
</body>
</html>`.trim();
}

function buildEmailText({ name, email, subject, message, submittedAt, ip }) {
  return [
    'New Contact Form Submission',
    '===========================',
    `Name:      ${name}`,
    `Email:     ${email}`,
    `Subject:   ${subject}`,
    '',
    'Message:',
    message,
    '',
    '---',
    `Submitted: ${submittedAt}`,
    `Sender IP: ${ip}`,
  ].join('\