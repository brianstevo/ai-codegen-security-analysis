const express = require('express');
const path = require('path');
const app = express();

app.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', filename);

  res.download(filePath, filename, (err) => {
    if (err) {
      res.status(404).send('File not found');
    }
  });
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});