const express = require("express");
const rateLimit = require("express-rate-limit");
const validator = require("validator");

const app = express();

// Parse JSON and URL-encoded form payloads
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// If behind a proxy/load balancer (e.g., Heroku, Nginx), trust proxy for correct IPs
app.set("trust proxy", 1);

// Rate limiting: max 5 contact submissions per IP per hour
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many submissions from this IP. Please try again in an hour.",
  },
});

// Helper: sanitize and normalize text safely
function sanitizeText(value, options = {}) {
  const {
    maxLength = 5000,
    trim = true,
    allowNewlines = true,
    fallback = "",
  } = options;

  let text = typeof value === "string" ? value : fallback;
  if (trim) text = text.trim();

  // Escape HTML entities
  text = validator.escape(text);

  // Optionally remove newlines
  if (!allowNewlines) {
    text = text.replace(/[\r\n]+/g, " ");
  }

  // Collapse excessive whitespace
  text = text.replace(/[ \t]{2,}/g, " ");

  // Enforce max length
  if (text.length > maxLength) {
    text = text.slice(0, maxLength);
  }

  return text;
}

// Contact form endpoint
app.post("/contact", contactLimiter, async (req, res) => {
  try {
    const {
      name,
      email,
      subject,
      message,
      website, // honeypot field: should remain empty for real users
    } = req.body;

    // Honeypot check (silent reject pattern)
    if (typeof website === "string" && website.trim() !== "") {
      return res.status(200).json({ success: true, message: "Message received." });
    }

    const errors = [];

    // Validate required fields
    if (!name || !validator.isLength(String(name).trim(), { min: 2, max: 100 })) {
      errors.push("Name must be between 2 and 100 characters.");
    }

    if (
      !email ||
      !validator.isEmail(String(email).trim(), {
        allow_utf8_local_part: false,
      }) ||
      !validator.isLength(String(email).trim(), { min: 5, max: 254 })
    ) {
      errors.push("A valid email is required.");
    }

    if (!subject || !validator.isLength(String(subject).trim(), { min: 3, max: 150 })) {
      errors.push("Subject must be between 3 and 150 characters.");
    }

    if (!message || !validator.isLength(String(message).trim(), { min: 10, max: 5000 })) {
      errors.push("Message must be between 10 and 5000 characters.");
    }

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    // Sanitize input for safe use in email template/logging
    const safeName = sanitizeText(name, { maxLength: 100, allowNewlines: false });
    const safeEmail = sanitizeText(
      validator.normalizeEmail(String(email).trim()) || String(email).trim(),
      { maxLength: 254, allowNewlines: false }
    );
    const safeSubject = sanitizeText(subject, { maxLength: 150, allowNewlines: false });
    const safeMessage = sanitizeText(message, { maxLength: 5000, allowNewlines: true });

    // Basic header injection prevention for email-like fields
    const headerInjectionPattern = /[\r\n]/;
    if (
      headerInjectionPattern.test(safeName) ||
      headerInjectionPattern.test(safeEmail) ||
      headerInjectionPattern.test(safeSubject)
    ) {
      return res.status(400).json({
        success: false,
        errors: ["Invalid characters detected in input."],
      });
    }

    // Build sanitized email template content
    const emailTemplate = `
New contact form submission

Name: ${safeName}
Email: ${safeEmail}
Subject: ${safeSubject}

Message:
${safeMessage}
`.trim();

    // TODO: Send email via your provider (nodemailer, SES, SendGrid, etc.)
    // Example:
    // await transporter.sendMail({
    //   to: "support@example.com",
    //   from: "no-reply@example.com",
    //   replyTo: safeEmail,
    //   subject: `[Contact] ${safeSubject}`,
    //   text: emailTemplate,
    // });

    // For demo purposes:
    console.log(emailTemplate);

    return res.status(200).json({
      success: true,
      message: "Your message has been sent successfully.",
    });
  } catch (err) {
    console.error("Contact form error:", err);
    return res.status(500).json({
      success: false,
      error: "An unexpected error occurred. Please try again later.",
    });
  }
});

// Optional health route
app.get("/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});