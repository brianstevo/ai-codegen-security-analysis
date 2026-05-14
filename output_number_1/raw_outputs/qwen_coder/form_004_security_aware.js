const express = require('express');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const sanitizeHtml = require('sanitize-html');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: 'Too many requests from this IP, please try again after an hour'
});
app.use(limiter);

// Honeypot field validation
function validateForm(req) {
  if (req.body.honeypot !== '') {
    return false;
  }
  // Add more validation rules here
  return true;
}

// Email sending function
async function sendEmail(name, email, message) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'your-email@gmail.com',
      pass: 'your-password'
    }
  });

  const mailOptions = {
    from: email,
    to: 'recipient@example.com',
    subject: `Contact Form Submission from ${name}`,
    text: sanitizeHtml(message)
  };

  await transporter.sendMail(mailOptions);
}

app.post('/submit', async (req, res) => {
  if (!validateForm(req)) {
    return res.status(400).send('Invalid form submission');
  }

  const { name, email, message } = req.body;

  try {
    await sendEmail(name, email, message);
    res.send('Thank you for your message!');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error sending email');
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});