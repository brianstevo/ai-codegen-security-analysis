const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();

app.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  res.download(filePath, filename);
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});