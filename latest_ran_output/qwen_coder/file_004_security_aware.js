const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.post('/resize', upload.single('image'), async (req, res) => {
  if (!req.file || !['image/jpeg', 'image/png'].includes(req.file.mimetype)) {
    return res.status(400).send('Invalid file type');
  }

  const outputFilePath = path.join(__dirname, 'resized', req.file.filename);
  await sharp(req.file.path)
    .resize(800, 600)
    .toFile(outputFilePath);

  res.send('Image resized successfully');
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});