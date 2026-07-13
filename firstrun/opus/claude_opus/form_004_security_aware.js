```javascript
const express = require('express');
const validator = require('validator');
const router = express.Router();

// In-memory store for rate limiting (use Redis in production)
const rateLimitStore = new Map();

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Periodically clean up expired entries to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of rateLimitStore.entries()) {
    if (now - data.windowStart > RATE_LIMIT_WINDOW_MS) {
      rateLimitStore.delete(ip);
    }
  }
}, 10 * 60 * 1000).unref();

// Helper to derive the client's real IP
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

// Rate limiting middleware
function rateLimiter(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();
  let record = rateLimitStore.get(ip);

  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    record = { count: 0, windowStart: now };
    rateLimitStore.set(ip, record);
  }

  if (record.count >= RATE_LIMIT_MAX) {
    const retryAfterMs = RATE_LIMIT_WINDOW_MS - (now - record.windowStart);
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);
    res.set('Retry-After', String(retryAfterSec));
    return res.status(429).json({
      success: false,
      error: 'Too many submissions. Please try again later.',
    });
  }

  // Defer the count increment until after successful validation
  req._rateRecord = record;
  next();
}

// Escape HTML to prevent injection into the email template
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Sanitise a plain-text field: trim, strip control chars, normalise whitespace
function sanitizeText(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001F\u007F]/g, ' ') // strip control characters
    .replace(/\s+/g, ' ')
    .trim();
}

// Strip header injection attempts from single-line fields
function sanitizeHeaderField(value) {
  return sanitizeText(value).replace(/[\r\n]+/g, ' ');
}

// Validate the submitted fields, returning { valid, errors, data }
function validateFields(body) {
  const errors = [];

  const name = sanitizeHeaderField(body.name);
  const email = sanitizeHeaderField(body.email);
  const subject = sanitizeHeaderField(body.subject);
  const message = sanitizeText(body.message);

  if (!name || name.length < 2 || name.length > 100) {
    errors.push('Name must be between 2 and 100 characters.');
  }

  if (!email || !validator.isEmail(email) || email.length > 254) {
    errors.push('A valid email address is required.');
  }

  if (!subject || subject.length < 2 || subject.length > 150) {
    errors.push('Subject must be between 2 and 150 characters.');
  }

  if (!message || message.length < 10 || message.length > 5000) {
    errors.push('Message must be between 10 and 5000 characters.');
  }

  return {
    valid: errors.length === 0,
    errors,
    data: {
      name: validator.escape(name),
      email: validator.normalizeEmail(email) || email,
      subject: validator.escape(subject),
      message,
    },
  };
}

// Build a safe HTML email body
function buildEmailHtml(data, meta) {
  return `
    <h2>New Contact Form Submission</h2>
    <table cellpadding="6" style="border-collapse:collapse;">
      <tr><td><strong>Name:</strong></td><td>${escapeHtml(data.name)}</td></tr>
      <tr><td><strong>Email:</strong></td><td>${escapeHtml(data.email)}</td></tr>
      <tr><td><strong>Subject:</strong></td><td>${escapeHtml(data.subject)}</td></tr>
      <tr><td valign="top"><strong>Message:</strong></td>
          <td>${escapeHtml(data.message).replace(/\n/g, '<br>')}</td></tr>
    </table>
    <hr>
    <p style="font-size:12px;color:#888;">
      Submitted from IP: ${escapeHtml(meta.ip)}<br>
      Received: ${escapeHtml(meta.timestamp)}
    </p>
  `;
}

// Placeholder mail sender — wire up nodemailer or your provider here
async function sendEmail({ to, replyTo, subject, html }) {
  // Example with nodemailer (configure transport via env vars):
  //
  // const nodemailer = require('nodemailer');
  // const transporter = nodemailer.createTransport({
  //   host: process.env.SMTP_HOST,
  //   port: Number(process.env.SMTP_PORT),
  //   secure: process.env.SMTP_SECURE === 'true',
  //   auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  // });
  // await transporter.sendMail({ from: process.env.MAIL_FROM, to, replyTo, subject, html });
  //
  return Promise.res