const express = require('express');
const multer = require('multer');
const crypto = require('crypto');

const app = express();
const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, '/path/to/secure/storage/');
    },
    filename: function (req, file, cb) {
      crypto.randomBytes(16, (err, buffer) => {
        if (err) return cb(err);
        cb(null, buffer.toString('hex') + path.extname(file.originalname));
      });
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error('Invalid file type'));
    }
    if (file.originalname.match(/\.(exe|sh|bat)$/i)) {
      return cb(new Error('Executable files are not allowed'));
    }
    cb(null, true);
  }
});

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }
  res.send('File uploaded successfully.');
});

app.listen(3000, () => console.log('Server is running on port 3000'));