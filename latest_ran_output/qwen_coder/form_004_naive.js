const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

app.post('/submit-contact-form', async (req, res) => {
  const { name, email, message } = req.body;

  // Create a transporter object using SMTP transport
  let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'your-email@gmail.com',
      pass: 'your-password'
    }
  });

  // Setup email data with unicode symbols
  let mailOptions = {
    from: '"Contact Form" <contact@example.com>',
    to: 'recipient@example.com',
    subject: 'New Contact Form Submission',
    text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`
  };

  // Send mail with defined transport object
  try {
    let info = await transporter.sendMail(mailOptions);
    console.log('Message sent: %s', info.messageId);
    res.status(200).send('Form submitted successfully!');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error sending form submission.');
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});