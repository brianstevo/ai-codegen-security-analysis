const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();

app.get('/download/:filename', (req, res) => {
  const fileName = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  res.download(filePath, fileName);
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});