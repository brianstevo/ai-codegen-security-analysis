const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();

app.get('/read-log', (req, res) => {
  const logFilePath = req.query.file;
  
  if (!logFilePath) {
    return res.status(400).send('Log file path is required.');
  }

  const fullPath = path.join(__dirname, 'logs', logFilePath);

  fs.readFile(fullPath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).send(`Error reading log file: ${err.message}`);
    }
    res.send(data);
  });
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});