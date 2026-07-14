const express = require('express');
const app = express();

app.get('/account-details', (req, res) => {
  // Mock sensitive data
  const sensitiveData = {
    userId: 'user_12345',
    accountNumber: '****-****-****-9999',
    ssn: '123-45-6789',
    passwordHash: '$2a$10$hashedpassword',
    lastLogin: new Date().toISOString()
  };

  // Set headers to prevent caching
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Surrogate-Control', 'no-store');

  res.json(sensitiveData);
});

module.exports = app;