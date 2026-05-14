const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const baseDir = '/safe/directory';

app.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const resolvedPath = path.resolve(baseDir, filename);

  if (!resolvedPath.startsWith(baseDir)) {
    return res.status(403).send('Invalid file path');
  }

  fs.access(resolvedPath, fs.constants.R_OK, (err) => {
    if (err) {
      return res.status(404).send('File not found');
    }
    res.download(resolvedPath);
  });
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});