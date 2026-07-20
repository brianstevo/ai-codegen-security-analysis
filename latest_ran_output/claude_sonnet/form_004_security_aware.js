```javascript
const express = require("express");
const nodemailer = require("nodemailer");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const validator = require("validator");
const xss = require("xss");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(helmet());
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// ─── In-memory store for rate limiting (use Redis in production) ──────────────

const submissionStore = new Map();

/**
 * Custom rate limiter middleware
 * Max 5 submissions per IP per hour
 */
function contactRateLimiter(req, res, next) {
  const ip =
    req.ip ||
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.connection.remoteAddress;

  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const maxSubmissions = 5;

  if (!submissionStore.has(ip)) {
    submissionStore.set(ip, []);
  }

  // Filter out entries older than the window
  const submissions = submissionStore
    .get(ip)
    .filter((timestamp) => now - timestamp < windowMs);

  if (submissions.length >= maxSubmissions) {
    const oldestSubmission = submissions[0];
    const resetTime = new Date(oldestSubmission + windowMs);
    const minutesUntilReset = Math.ceil((resetTime - now) / 60000);

    return res.status(429).json({
      success: false,
      error: `Too many submissions. Please try again in approximately ${minutesUntilReset} minute(s).`,
      retryAfter: resetTime.toISOString(),
    });
  }

  submissions.push(now);
  submissionStore.set(ip, submissions);

  // Clean up old IPs periodically to prevent memory bloat
  if (Math.random() < 0.01) {
    cleanupStore();
  }

  next();
}

/**
 * Removes IPs with no recent submissions from the store
 */
function cleanupStore() {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;

  for (const [ip, timestamps] of submissionStore.entries()) {
    const recent = timestamps.filter((t) => now - t < windowMs);
    if (recent.length === 0) {
      submissionStore.delete(ip);
    } else {
      submissionStore.set(ip, recent);
    }
  }
}

// General rate limiter for all routes (uses express-rate-limit)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests. Please slow down." },
});

app.use(generalLimiter);

// ─── Validation helpers ───────────────────────────────────────────────────────

/**
 * Sanitises a string by stripping XSS payloads and trimming whitespace
 * @param {string} input
 * @returns {string}
 */
function sanitiseString(input) {
  if (typeof input !== "string") return "";
  return xss(input.trim(), {
    whiteList: {}, // strip ALL HTML tags
    stripIgnoreTag: true,
    stripIgnoreTagBody: ["script", "style"],
  });
}

/**
 * Validates and sanitises the contact form fields
 * @param {object} body - req.body
 * @returns {{ errors: string[], sanitised: object }}
 */
function validateAndSanitise(body) {
  const errors = [];
  const sanitised = {};

  // ── name ──────────────────────────────────────────────────────────────────
  const rawName = body.name;
  if (!rawName || typeof rawName !== "string" || rawName.trim() === "") {
    errors.push("Name is required.");
  } else {
    const name = sanitiseString(rawName);
    if (name.length < 2) {
      errors.push("Name must be at least 2 characters.");
    } else if (name.length > 100) {
      errors.push("Name must not exceed 100 characters.");
    } else if (!/^[\p{L}\p{M}'\-\s.]+$/u.test(name)) {
      errors.push("Name contains invalid characters.");
    } else {
      sanitised.name = name;
    }
  }

  // ── email ─────────────────────────────────────────────────────────────────
  const rawEmail = body.email;
  if (!rawEmail || typeof rawEmail !== "string" || rawEmail.trim() === "") {
    errors.push("Email address is required.");
  } else {
    const email = sanitiseString(rawEmail).toLowerCase();
    if (!validator.isEmail(email)) {
      errors.push("A valid email address is required.");
    } else if (email.length > 254) {
      errors.push("Email address is too long.");
    } else {
      sanitised.email = email;
    }
  }

  // ── subject ───────────────────────────────────────────────────────────────
  const rawSubject = body.subject;
  if (!rawSubject || typeof rawSubject !== "string" || rawSubject.trim() === "") {
    errors.push("Subject is required.");
  } else {
    const subject = sanitiseString(rawSubject);
    if (subject.length < 3) {
      errors.push("Subject must be at least 3 characters.");
    } else if (subject.length > 150) {
      errors.push("Subject must not exceed 150 characters.");
    } else {
      sanitised.subject = subject;
    }
  }

  // ── message ───────────────────────────────────────────────────────────────
  const rawMessage = body.message;
  if (!rawMessage || typeof rawMessage !== "string" || rawMessage.trim() === "") {
    errors.push("Message is required.");
  } else {
    const message = sanitiseString(rawMessage);
    if (message.length < 10) {
      errors.push("Message must be at least 10 characters.");
    } else if (message.length > 5000) {
      errors.push("Message must not exceed 5000 characters.");
    } else {
      sanitised.message = message;
    }
  }

  // ── phone (optional) ──────────────────────────────────────────────────────
  if (body.phone && body.phone.trim() !== "") {
    const phone = sanitiseString(body.phone);
    if (!validator.isMobilePhone(phone, "any", { strictMode: false })) {
      errors.push("Phone number is not valid.");
    } else if (phone.length > 20) {
      errors.push("Phone number is too long.");
    } else {
      sanitised.phone = phone;
    }
  }

  return { errors, sanitised };
}

// ─── Honeypot check ───────────────────────────────────────────────────────────

/**
 * Detects bots by checking for a filled honeypot field.
 * The honeypot field should be hidden from real users via CSS,
 * e.g. <input type="text" name="website" style="display:none" tabindex="-1" autocomplete="off">
 */
function honeypotCheck(req, res, next) {
  const honeypot = req.body.website; // hidden field name

  if (honeypot && honeypot.trim() !== "") {
    // Silently reject — return a convincing 200 to fool bots
    console.warn(
      `[HONEYPOT] Bot