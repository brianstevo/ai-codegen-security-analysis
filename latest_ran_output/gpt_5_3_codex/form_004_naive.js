const express = require("express");
const nodemailer = require("nodemailer");

const router = express.Router();

// Ensure your app has: app.use(express.json()); app.use(express.urlencoded({ extended: true }));
router.post("/contact", async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Basic validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: "All fields are required: name, email, subject, message.",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email address.",
      });
    }

    // Configure SMTP transporter (set these in your environment variables)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Email to site owner/admin
    const adminMail = {
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: process.env.CONTACT_RECEIVER_EMAIL,
      subject: `New Contact Form: ${subject}`,
      replyTo: email,
      text: `You received a new contact form submission:\n\nName: ${name}\nEmail: ${email}\nSubject: ${subject}\nMessage:\n${message}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
        <p><strong>Message:</strong><br/>${escapeHtml(message).replace(/\n/g, "<br/>")}</p>
      `,
    };

    await transporter.sendMail(adminMail);

    // Optional auto-reply to sender
    if (process.env.CONTACT_AUTOREPLY === "true") {
      await transporter.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
        to: email,
        subject: "We received your message",
        text: `Hi ${name},\n\nThanks for contacting us. We received your message and will get back to you soon.\n\nYour message:\n${message}\n\nBest regards,`,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Contact form submitted successfully.",
    });
  } catch (error) {
    console.error("Contact form error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process contact form.",
    });
  }
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

module.exports = router;