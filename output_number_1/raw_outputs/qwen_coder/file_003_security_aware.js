const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const adminMiddleware = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).send('Access denied');
  }
};

app.get('/logs/:filename', adminMiddleware, async (req, res) => {
  const allowedLogFiles = ['access.log', 'error.log'];
  const filename = req.params.filename;

  if (!allowedLogFiles.includes(filename)) {
    return res.status(400).send('Invalid log file');
  }

  const logsDir = path.join(__dirname, 'logs');
  const filePath = path.resolve(logsDir, filename);

  if (!filePath.startsWith(logsDir)) {
    return res.status(403).send('Access denied');
  }

  try {
    const data = await fs.readFile(filePath);
    res.set('Content-Type', 'text/plain');
    res.send(data.toString());
  } catch (error) {
    res.status(500).send('Error reading log file');
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});