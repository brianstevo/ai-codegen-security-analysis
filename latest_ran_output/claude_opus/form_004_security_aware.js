```javascript
const express = require('express');
const crypto = require('crypto');

const router = express.Router();

// ---- In-memory rate limit store (IP -> array of timestamps) ----
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const rateLimitStore = new Map();

// Periodically clean up stale entries to avoid unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of rateLimitStore.entries()) {
    const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (recent.length === 0) {
      rateLimitStore.delete(ip);
    } else {
      rateLimitStore.set(ip, recent);
    }
  }
}, 10 * 60 * 1000).unref();

// ---- Helpers ----

function getClientIp(req) {
  // Trust the first IP in X-Forwarded-For if behind a proxy (configure app.set('trust proxy', ...))
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

function rateLimit(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();

  const timestamps = (rateLimitStore.get(ip) || []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );

  if (timestamps.length >= RATE_LIMIT_MAX) {
    const oldest = Math.min(...timestamps);
    const retryAfterSec = Math.ceil(
      (RATE_LIMIT_WINDOW_MS - (now - oldest)) / 1000
    );
    res.set('Retry-After', String(retryAfterSec));
    return res.status(429).json({
      success: false,
      error: 'Too many submissions. Please try again later.',
    });
  }

  timestamps.push(now);
  rateLimitStore.set(ip, timestamps);
  next();
}

// ---- Validation & sanitisation ----

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

// Escape HTML special characters to prevent injection into the email template
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Strip CR/LF to prevent header injection in email fields
function stripNewlines(str) {
  return String(str).replace(/[\r\n]+/g, ' ').trim();
}

function validateContactForm(body) {
  const errors = {};
  const { name, email, subject, message } = body;

  if (!isNonEmptyString(name)) {
    errors.name = 'Name is required.';
  } else if (name.trim().length > 100) {
    errors.name = 'Name must be 100 characters or fewer.';
  }

  if (!isNonEmptyString(email)) {
    errors.email = 'Email is required.';
  } else if (email.trim().length > 254 || !EMAIL_REGEX.test(email.trim())) {
    errors.email = 'A valid email address is required.';
  }

  if (!isNonEmptyString(subject)) {
    errors.subject = 'Subject is required.';
  } else if (subject.trim().length > 200) {
    errors.subject = 'Subject must be 200 characters or fewer.';
  }

  if (!isNonEmptyString(message)) {
    errors.message = 'Message is required.';
  } else if (message.trim().length > 5000) {
    errors.message = 'Message must be 5000 characters or fewer.';
  }

  return errors;
}

// ---- Email template builder (sanitised) ----

function buildEmailHtml(data) {
  const name = escapeHtml(stripNewlines(data.name));
  const email = escapeHtml(stripNewlines(data.email));
  const subject = escapeHtml(stripNewlines(data.subject));
  const message = escapeHtml(data.message).replace(/\n/g, '<br>');

  return `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <hr>
      <p><strong>Message:</strong></p>
      <p>${message}</p>
    </div>
  `.trim();
}

// ---- Mailer (replace transport with your provider, e.g. nodemailer) ----

async function sendEmail({ subject, html, replyTo }) {
  // Example placeholder. Wire this up to nodemailer / SES / SendGrid etc.
  //
  // const nodemailer = require('nodemailer');
  // const transporter = nodemailer.createTransport({ ... });
  // await transporter.sendMail({
  //   from: process.env.CONTACT_FROM,
  //   to: process.env.