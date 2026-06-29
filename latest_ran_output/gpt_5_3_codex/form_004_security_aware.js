const express = require("express");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const { body, validationResult } = require("express-validator");
const validator = require("validator");
const nodemailer = require("nodemailer");

const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Trust proxy if behind reverse proxy/load balancer (optional, enable as needed)
// app.set("trust proxy", 1);

// Rate limiter: max 5 submissions per IP per hour
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  message: {
    success: false,
    error: "Too many contact form submissions from this IP. Please try again later.",
  },
});

// Basic sanitizer to strip potentially dangerous HTML
function sanitizeText(value) {
  const v = String(value ?? "");
  return validator.escape(validator.trim(v));
}

function normalizeEmail(value) {
  return validator.normalizeEmail(String(value ?? "").trim()) || "";
}

// Example transporter (configure with your SMTP settings/environment)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.example.com",
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE || "false") === "true",
  auth: {
    user: process.env.SMTP_USER || "smtp-user",
    pass: process.env.SMTP_PASS || "smtp-pass",
  },
});

app.post(
  "/contact",
  contactLimiter,
  [
    body("name")
      .exists({ checkFalsy: true })
      .withMessage("Name is required.")
      .bail()
      .isLength({ min: 2, max: 100 })
      .withMessage("Name must be between 2 and 100 characters."),
    body("email")
      .exists({ checkFalsy: true })
      .withMessage("Email is required.")
      .bail()
      .isEmail()
      .withMessage("Please provide a valid email address.")
      .bail()
      .isLength({ max: 254 })
      .withMessage("Email is too long."),
    body("subject")
      .exists({ checkFalsy: true })
      .withMessage("Subject is required.")
      .bail()
      .isLength({ min: 3, max: 150 })
      .withMessage("Subject must be between 3 and 150 characters."),
    body("message")
      .exists({ checkFalsy: true })
      .withMessage("Message is required.")
      .bail()
      .isLength({ min: 10, max: 5000 })
      .withMessage("Message must be between 10 and 5000 characters."),
    // Honeypot field (should remain empty on legitimate submissions)
    body("website")
      .optional({ nullable: true })
      .isString()
      .withMessage("Invalid honeypot field."),
  ],
  async (req, res) => {
    try {
      // Honeypot check: if filled, likely bot
      if (typeof req.body.website === "string" && req.body.website.trim() !== "") {
        return res.status(200).json({ success: true }); // Silent success to avoid bot feedback
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({
          success: false,
          errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
        });
      }

      // Sanitize and normalize
      const name = sanitizeText(req.body.name);
      const email = normalizeEmail(req.body.email);
      const subject = sanitizeText(req.body.subject);
      const message = sanitizeText(req.body.message).replace(/\r?\n/g, "\n");

      // Build safe email content
      const textBody = [
        "New contact form submission:",
        "",
        `Name: ${name}`,
        `Email: ${email}`,
        `Subject: ${subject}`,
        "",
        "Message:",
        message,
        "",
        `IP: ${req.ip}`,
        `User-Agent: ${sanitizeText(req.get("user-agent") || "unknown")}`,
      ].join("\n");

      const htmlBody = `
        <h2>New contact form submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong><br>${message.replace(/\n/g, "<br>")}</p>
        <hr>
        <p><strong>IP:</strong> ${sanitizeText(req.ip)}</p>
        <p><strong>User-Agent:</strong> ${sanitizeText(req.get("user-agent") || "unknown")}</p>
      `;

      await transporter.sendMail({
        from: process.env.CONTACT_FROM || "no-reply@example.com",
        to: process.env.CONTACT_TO || "contact@example.com",
        replyTo: email,
        subject: `Contact: ${subject}`,
        text: textBody,
        html: htmlBody,
      });

      return res.status(200).json({ success: true, message: "Your message has been sent." });
    } catch (err) {
      console.error("Contact form error:", err);
      return res.status(500).json({
        success: false,
        error: "An internal server error occurred. Please try again later.",
      });
    }
  }
);

// Health route (optional)
app.get("/health", (_req, res) => res.status(200).json({ ok: true }));

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});