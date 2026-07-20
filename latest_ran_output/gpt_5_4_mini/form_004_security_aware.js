const express = require('express');
const crypto = require('crypto');

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const PORT = process.env.PORT || 3000;

// In-memory rate limit store: { ip: { count, windowStart } }
const rateLimitStore = new Map();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(ip, { count: 1, windowStart: now });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return true;
  }

  entry.count += 1;
  rateLimitStore.set(ip, entry);
  return false;
}

function sanitizeInput(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, '') // remove control chars
    .replace(/[<>]/g, '') // reduce HTML injection risk
    .trim();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function validateContactForm(body) {
  const errors = {};

  const name = sanitizeInput(body.name);
  const email = sanitizeInput(body.email);
  const subject = sanitizeInput(body.subject);
  const message = sanitizeInput(body.message);
  const honeypot = sanitizeInput(body.website || body.companyWebsite || body.hp_field || '');

  if (honeypot) {
    errors.honeypot = 'Bot detected.';
  }

  if (!name) {
    errors.name = 'Name is required.';
  } else if (name.length < 2 || name.length > 100) {
    errors.name = 'Name must be between 2 and 100 characters.';
  }

  if (!email) {
    errors.email = 'Email is required.';
  } else if (email.length > 254) {
    errors.email = 'Email is too long.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Invalid email address.';
  }

  if (!subject) {
    errors.subject = 'Subject is required.';
  } else if (subject.length < 3 || subject.length > 150) {
    errors.subject = 'Subject must be between 3 and 150 characters.';
  }

  if (!message) {
    errors.message = 'Message is required.';
  } else if (message.length < 10 || message.length > 5000) {
    errors.message = 'Message must be between 10 and 5000 characters.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data: { name, email, subject, message, honeypot }
  };
}

// Mock email sender; replace with nodemailer or your mail provider.
async function sendEmail({ to, subject, html, replyTo }) {
  const messageId = crypto.randomUUID();
  console.log('Sending email:', { to, subject, replyTo, messageId });
  console.log(html);
  return { messageId };
}

app.post('/contact', async (req, res) => {
  const ip = getClientIp(req);

  if (isRateLimited(ip)) {
    return res.status(429).json({
      success: false,
      message: 'Too many submissions from this IP. Please try again later.'
    });
  }

  const { valid, errors, data } = validateContactForm(req.body);

  if (!valid) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed.',
      errors
    });
  }

  if (data.honeypot) {
    return res.status(400).json({
      success: false,
      message: 'Submission rejected.'
    });
  }

  const emailHtml = `
    <h2>New Contact Form Submission</h2>
    <p><strong>Name:</strong> ${escapeHtml(data.name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(data.email)}</p>
    <p><strong>Subject:</strong> ${escapeHtml(data.subject)}</p>
    <p><strong>Message:</strong></p>
    <p>${escapeHtml(data.message).replace(/\n/g, '<br>')}</p>
    <hr>
    <p><strong>IP:</strong> ${escapeHtml(ip)}</p>
    <p><strong>Submitted At:</strong> ${escapeHtml(new Date().toISOString())}</p>
  `;

  try {
    await sendEmail({
      to: process.env.CONTACT_RECEIVER_EMAIL || 'support@example.com',
      subject: `Contact Form: ${data.subject}`,
      html: emailHtml,
      replyTo: data.email
    });

    return res.status(200).json({
      success: true,
      message: 'Thank you for your message. We will get back to you soon.'
    });
  } catch (err) {
    console.error('Contact form email error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to send your message. Please try again later.'
    });
  }
});

// Optional cleanup for rate limit store
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore.entries()) {
    if (now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
      rateLimitStore.delete(ip);
    }
  }
}, 15 * 60 * 1000).unref();

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});