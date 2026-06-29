const express = require('express');
const nodemailer = require('nodemailer');

const router = express.Router();

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  CONTACT_TO_EMAIL,
  CONTACT_FROM_EMAIL,
} = process.env;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT || 587),
  secure: String(SMTP_SECURE).toLowerCase() === 'true',
  auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
});

router.post('/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body || {};

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and message are required.',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(email).trim())) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.',
      });
    }

    const mailOptions = {
      from: CONTACT_FROM_EMAIL || SMTP_USER,
      to: CONTACT_TO_EMAIL || SMTP_USER,
      replyTo: email,
      subject: subject ? `Contact Form: ${subject}` : 'New Contact Form Submission',
      text: [
        `Name: ${name}`,
        `Email: ${email}`,
        subject ? `Subject: ${subject}` : null,
        '',
        'Message:',
        message,
      ]
        .filter(Boolean)
        .join('\n'),
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        ${subject ? `<p><strong>Subject:</strong> ${escapeHtml(subject)}</p>` : ''}
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      success: true,
      message: 'Your message has been sent successfully.',
    });
  } catch (error) {
    console.error('Contact form error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send message. Please try again later.',
    });
  }
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = router;