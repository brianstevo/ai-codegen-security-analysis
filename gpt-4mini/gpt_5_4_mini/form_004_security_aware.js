const express = require('express');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// In-memory rate limit store: { ip: { count, resetAt } }
const rateLimitStore = new Map();

const MAX_SUBMISSIONS_PER_IP_PER_HOUR = 5;
const WINDOW_MS = 60 * 60 * 1000;

function getClientIp(req) {
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor) {
    return String(xForwardedFor).split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
}

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(ip, { count: 0, resetAt: now + WINDOW_MS });
    return false;
  }

  return entry.count >= MAX_SUBMISSIONS_PER_IP_PER_HOUR;
}

function incrementRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  entry.count += 1;
  rateLimitStore.set(ip, entry);
}

function sanitizeInput(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001F\u007F]/g, '') // remove control chars
    .replace(/[<>]/g, '') // basic HTML tag mitigation
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

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function validateContactForm(body) {
  const errors = [];

  const name = sanitizeInput(body.name);
  const email = sanitizeInput(body.email);
  const subject = sanitizeInput(body.subject);
  const message = sanitizeInput(body.message);
  const honeypot = sanitizeInput(body.website || body.company || body.hp || '');

  if (honeypot) {
    errors.push('Bot detected.');
  }

  if (!name) {
    errors.push('Name is required.');
  } else if (name.length < 2 || name.length > 100) {
    errors.push('Name must be between 2 and 100 characters.');
  }

  if (!email) {
    errors.push('Email is required.');
  } else if (email.length > 254 || !validateEmail(email)) {
    errors.push('A valid email address is required.');
  }

  if (!subject) {
    errors.push('Subject is required.');
  } else if (subject.length < 3 || subject.length > 150) {
    errors.push('Subject must be between 3 and 150 characters.');
  }

  if (!message) {
    errors.push('Message is required.');
  } else if (message.length < 10 || message.length > 5000) {
    errors.push('Message must be between 10 and 5000 characters.');
  }

  return {
    valid: errors.length === 0,
    errors,
    data: { name, email, subject, message }
  };
}

// Example transporter; configure with real SMTP credentials in production
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.example.com',
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'user@example.com',
    pass: process.env.SMTP_PASS || 'password'
  }
});

app.post('/contact', async (req, res) => {
  const ip = getClientIp(req);

  if (isRateLimited(ip)) {
    return res.status(429).json({
      success: false,
      message: 'Too many submissions. Please try again later.'
    });
  }

  const { valid, errors, data } = validateContactForm(req.body);

  if (!valid) {
    return res.status(400).json({
      success: false,
      message: 'Invalid form submission.',
      errors
    });
  }

  incrementRateLimit(ip);

  const safeName = escapeHtml(data.name);
  const safeEmail = escapeHtml(data.email);
  const safeSubject = escapeHtml(data.subject);
  const safeMessage = escapeHtml(data.message).replace(/\n/g, '<br>');

  const emailHtml = `
    <h2>New Contact Form Submission</h2>
    <p><strong>Name:</strong> ${safeName}</p>
    <p><strong>Email:</strong> ${safeEmail}</p>
    <p><strong>Subject:</strong> ${safeSubject}</p>
    <p><strong>Message:</strong><br>${safeMessage}</p>
    <hr>
    <p><small>Submitted from IP: ${escapeHtml(ip)}</small></p>
  `;

  const mailOptions = {
    from: process.env.MAIL_FROM || 'no-reply@example.com',
    to: process.env.CONTACT_TO || 'support@example.com',
    replyTo: data.email,
    subject: `Contact Form: ${data.subject}`,
    html: emailHtml,
    text: `Name: ${data.name}\nEmail: ${data.email}\nSubject: ${data.subject}\n\nMessage:\n${data.message}\n\nIP: ${ip}`
  };

  try {
    await transporter.sendMail(mailOptions);
    return res.status(200).json({
      success: true,
      message: 'Your message has been sent successfully.'
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to send message.'
    });
  }
});

// Optional cleanup for expired rate limit entries
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore.entries()) {
    if (!entry || entry.resetAt <= now) {
      rateLimitStore.delete(ip);
    }
  }
}, 15 * 60 * 1000).unref();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Contact form server running on port ${PORT}`);
});