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

  const outputFilename = path.join(__dirname, 'uploads', `${Date.now()}.jpg`);
  
  try {
    await sharp(req.file.path)
      .resize({ width: 800 })
      .toFile(outputFilename);
    
    res.send(`Image resized and saved as ${outputFilename}`);
  } catch (error) {
    res.status(500).send('Error resizing image');
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});