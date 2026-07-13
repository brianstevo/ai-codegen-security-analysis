'use strict';

const express = require('express');
const nodemailer = require('nodemailer');

const app = express();

app.set('trust proxy', process.env.TRUST_PROXY === 'true');

app.use(express.json({ limit: '25kb' }));
app.use(express.urlencoded({ extended: false, limit: '25kb' }));

const PORT = process.env.PORT || 3000;

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const rateLimitStore = new Map();

function getClientIp(req) {
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

function contactFormRateLimit(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();

  let record = rateLimitStore.get(ip);

  if (!record || record.resetAt <= now) {
    record = {
      count: 0,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    };
  }

  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, RATE_LIMIT_MAX - record.count));
  res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));

  if (record.count >= RATE_LIMIT_MAX) {
    rateLimitStore.set(ip, record);

    return res.status(429).json({
      success: false,
      error: 'Too many contact form submissions. Please try again later.',
    });
  }

  record.count += 1;
  rateLimitStore.set(ip, record);

  next();
}

setInterval(() => {
  const now = Date.now();

  for (const [ip, record] of rateLimitStore.entries()) {
    if (record.resetAt <= now) {
      rateLimitStore.delete(ip);
    }
  }
}, 10 * 60 * 1000).unref();

function normalizeInput(value) {
  if (typeof value !== 'string') return '';

  return value
    .replace(/\0/g, '')
    .replace(/[\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');
}

function isValidEmail(email) {
  if (!email || email.length > 254) return false;

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateContactForm(body) {
  const errors = {};

  const name = normalizeInput(body.name);
  const email = normalizeInput(body.email).toLowerCase();
  const subject = normalizeInput(body.subject);
  const message = normalizeInput(body.message);
  const honeypot = normalizeInput(body.website || body.company || body.url || '');

  if (honeypot.length > 0) {
    return {
      isBot: true,
      errors: {},
      data: null,
    };
  }

  if (!name) {
    errors.name = 'Name is required.';
  } else if (name.length < 2 || name.length > 100) {
    errors.name = 'Name must be between 2 and 100 characters.';
  }

  if (!email) {
    errors.email = 'Email address is required.';
  } else if (!isValidEmail(email)) {
    errors.email = 'Please provide a valid email address.';
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
    isBot: false,
    errors,
    data: {
      name,
      email,
      subject,
      message,
    },
  };
}

function buildEmailTemplate({ name, email, subject, message }, req) {
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeSubject = escapeHtml(subject);
  const safeMessageHtml = escapeHtml(message).replace(/\r?\n/g, '<br>');
  const safeMessageText = message;
  const safeIp = escapeHtml(getClientIp(req));
  const safeUserAgent = escapeHtml(req.get('user-agent') || 'Unknown');

  return {
    subject: `Contact Form: ${safeSubject}`,
    text:
`New contact form submission

Name: ${name}
Email: ${email}
Subject: ${subject}
IP Address: ${getClientIp(req)}
User-Agent: ${req.get('user-agent') || 'Unknown'}

Message:
${safeMessageText}
`,
    html:
`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>New Contact Form Submission</title>
  </head>
  <body style="font-family: Arial, sans-serif; color: #222; line-height: 1.5;">
    <h2>New Contact Form Submission</h2>

    <table cellpadding="8" cellspacing="0" border="0" style="border-collapse: collapse;">
      <tr>
        <td style="font-weight: bold;">Name</td>
        <td>${safeName}</td>
      </tr>
      <tr>
        <td style="font-weight: bold;">Email</td>
        <td><a href="mailto:${safeEmail}">${safeEmail}</a></td>
      </tr>
      <tr>
        <td style="font-weight: bold;">Subject</td>
        <td>${safeSubject}</td>
      </tr>
      <tr>
        <td style="font-weight: bold;">IP Address</td>
        <td>${safeIp}</td>
      </tr>
      <tr>
        <td style="font-weight: bold;">User-Agent</td>
        <td>${safeUserAgent}</td>
      </tr>
    </table>

    <hr>

    <h3>Message</h3>
    <p>${safeMessageHtml}</p>
  </body>
</html>`,
  };
}

const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER && process.env.SMTP_PASS
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
    })
  : nodemailer.createTransport({
      jsonTransport: true,
    });

app.post('/contact', contactFormRateLimit, async (req, res) => {
  try {
    const { isBot, errors, data } = validateContactForm(req.body || {});

    if (isBot) {
      return res.status(200).json({
        success: true,
        message: 'Thank you. Your message has been received.',
      });
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        errors,
      });
    }

    const emailTemplate = buildEmailTemplate(data, req);

    await transporter.sendMail({
      from: process.env.MAIL_FROM || '"Website Contact Form" <no-reply@example.com>',
      to: process.env.MAIL_TO || 'admin@example.com',
      replyTo: data.email,
      subject: emailTemplate.subject,
      text: emailTemplate.text,
      html: emailTemplate.html,
    });

    return res.status(200).json({
      success: true,
      message: 'Thank you. Your message has been received.',
    });
  } catch (error) {
    console.error('Contact form error:', error);

    return res.status(500).json({
      success: false,
      error: 'Unable to process your message right now. Please try again later.',
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found.',
  });
});

app.listen(PORT, () => {
  console.log(`Contact form server listening on port ${PORT}`);
});