const express = require("express");
const nodemailer = require("nodemailer");

const app = express();

app.set("trust proxy", 1);

app.use(express.json({ limit: "25kb" }));
app.use(express.urlencoded({ extended: false, limit: "25kb" }));

const PORT = process.env.PORT || 3000;

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_SUBMISSIONS = 5;
const contactRateLimitStore = new Map();

function getClientIp(req) {
  return req.ip || req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
}

function contactRateLimiter(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();

  let record = contactRateLimitStore.get(ip);

  if (!record || record.resetAt <= now) {
    record = {
      count: 0,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    };
  }

  record.count += 1;
  contactRateLimitStore.set(ip, record);

  const remaining = Math.max(RATE_LIMIT_MAX_SUBMISSIONS - record.count, 0);
  const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);

  res.setHeader("X-RateLimit-Limit", RATE_LIMIT_MAX_SUBMISSIONS);
  res.setHeader("X-RateLimit-Remaining", remaining);
  res.setHeader("X-RateLimit-Reset", Math.ceil(record.resetAt / 1000));

  if (record.count > RATE_LIMIT_MAX_SUBMISSIONS) {
    res.setHeader("Retry-After", retryAfterSeconds);
    return res.status(429).json({
      ok: false,
      error: "Too many contact form submissions. Please try again later.",
    });
  }

  next();
}

setInterval(() => {
  const now = Date.now();

  for (const [ip, record] of contactRateLimitStore.entries()) {
    if (record.resetAt <= now) {
      contactRateLimitStore.delete(ip);
    }
  }
}, 10 * 60 * 1000).unref();

function normalizeInput(value) {
  if (typeof value !== "string") return "";

  return value
    .replace(/\0/g, "")
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

function stripHeaderInjection(value) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\//g, "&#x2F;");
}

function isValidEmail(email) {
  if (email.length > 254) return false;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return emailRegex.test(email);
}

function validateContactForm(body) {
  const errors = {};

  const name = normalizeInput(body.name);
  const email = normalizeInput(body.email).toLowerCase();
  const subject = normalizeInput(body.subject);
  const message = normalizeInput(body.message);
  const honeypot = normalizeInput(body.company || body.website || body.url || "");

  if (honeypot.length > 0) {
    return {
      isBot: true,
      errors: {},
      values: null,
    };
  }

  if (!name) {
    errors.name = "Name is required.";
  } else if (name.length < 2) {
    errors.name = "Name must be at least 2 characters.";
  } else if (name.length > 100) {
    errors.name = "Name must be 100 characters or fewer.";
  }

  if (!email) {
    errors.email = "Email is required.";
  } else if (!isValidEmail(email)) {
    errors.email = "A valid email address is required.";
  }

  if (!subject) {
    errors.subject = "Subject is required.";
  } else if (subject.length < 3) {
    errors.subject = "Subject must be at least 3 characters.";
  } else if (subject.length > 150) {
    errors.subject = "Subject must be 150 characters or fewer.";
  }

  if (!message) {
    errors.message = "Message is required.";
  } else if (message.length < 10) {
    errors.message = "Message must be at least 10 characters.";
  } else if (message.length > 5000) {
    errors.message = "Message must be 5000 characters or fewer.";
  }

  return {
    isBot: false,
    errors,
    values: {
      name,
      email,
      subject,
      message,
    },
  };
}

function buildEmailTemplate(values, req) {
  const safeName = escapeHtml(values.name);
  const safeEmail = escapeHtml(values.email);
  const safeSubject = escapeHtml(values.subject);
  const safeMessageHtml = escapeHtml(values.message).replace(/\n/g, "<br>");
  const safeIp = escapeHtml(getClientIp(req));
  const safeUserAgent = escapeHtml(req.get("user-agent") || "Unknown");

  const text = [
    "New contact form submission",
    "",
    `Name: ${values.name}`,
    `Email: ${values.email}`,
    `Subject: ${values.subject}`,
    "",
    "Message:",
    values.message,
    "",
    `IP Address: ${getClientIp(req)}`,
    `User-Agent: ${req.get("user-agent") || "Unknown"}`,
  ].join("\n");

  const html = `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>New Contact Form Submission</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.5; color: #222;">
        <h2>New Contact Form Submission</h2>
        <table cellpadding="8" cellspacing="0" border="0" style="border-collapse: collapse;">
          <tr>
            <th align="left" style="border-bottom: 1px solid #ddd;">Name</th>
            <td style="border-bottom: 1px solid #ddd;">${safeName}</td>
          </tr>
          <tr>
            <th align="left" style="border-bottom: 1px solid #ddd;">Email</th>
            <td style="border-bottom: 1px solid #ddd;">${safeEmail}</td>
          </tr>
          <tr>
            <th align="left" style="border-bottom: 1px solid #ddd;">Subject</th>
            <td style="border-bottom: 1px solid #ddd;">${safeSubject}</td>
          </tr>
        </table>

        <h3>Message</h3>
        <p>${safeMessageHtml}</p>

        <hr>

        <p style="font-size: 12px; color: #666;">
          IP Address: ${safeIp}<br>
          User-Agent: ${safeUserAgent}
        </p>
      </body>
    </html>
  `;

  return { text, html };
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: process.env.SMTP_USER && process.env.SMTP_PASS
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      }
    : undefined,
});

app.post("/contact", contactRateLimiter, async (req, res) => {
  try {
    const validation = validateContactForm(req.body || {});

    if (validation.isBot) {
      return res.status(200).json({
        ok: true,
        message: "Thank you. Your message has been received.",
      });
    }

    if (Object.keys(validation.errors).length > 0) {
      return res.status(400).json({
        ok: false,
        errors: validation.errors,
      });
    }

    const values = validation.values;
    const { text, html } = buildEmailTemplate(values, req);

    await transporter.sendMail({
      from: process.env.MAIL_FROM || "Contact Form <no-reply@example.com>",
      to: process.env.MAIL_TO || "admin@example.com",
      replyTo: `${stripHeaderInjection(values.name)} <${stripHeaderInjection(values.email)}>`,
      subject: `Contact Form: ${stripHeaderInjection(values.subject)}`,
      text,
      html,
    });

    return res.status(200).json({
      ok: true,
      message: "Thank you. Your message has been sent.",
    });
  } catch (error) {
    console.error("Contact form error:", error);

    return res.status(500).json({
      ok: false,
      error: "Unable to send your message right now. Please try again later.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});