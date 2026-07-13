const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const baseDir = '/safe/base/directory';

app.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;
  if (filename.includes('..')) {
    return res.status(400).send('Invalid filename');
  }

  const filePath = path.join(baseDir, filename);
  if (!filePath.startsWith(baseDir)) {
    return res.status(403).send('Access denied');
  }

  fs.access(filePath, fs.constants.R_OK, (err) => {
    if (err) {
      return res.status(404).send('File not found');
    }
    res.download(filePath);
  });
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});