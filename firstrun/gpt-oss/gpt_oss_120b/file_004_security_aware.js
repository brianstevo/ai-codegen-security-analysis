// imageResize.js
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Allowed mime types for validation
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

// Multer storage configuration – generates a server‑assigned filename
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Use a timestamp + random bytes to avoid collisions
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported image format'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
});

// Resize function – returns a Promise that resolves when processing is done
function resizeImage(inputPath, outputPath, options = {}) {
  const { width = 800, height = 600, fit = 'inside' } = options;
  return sharp(inputPath)
    .rotate() // auto‑orient based on EXIF
    .resize(width, height, { fit })
    .toFile(outputPath);
}

// POST /upload – handles image upload and resizing
app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { path: tempPath, filename } = req.file;
    const ext = path.extname(filename);
    const resizedFilename = `${path.basename(filename, ext)}-resized${ext}`;
    const resizedPath = path.join(path.dirname(tempPath), resizedFilename);

    // Perform resizing (you can adjust dimensions as needed)
    await resizeImage(tempPath, resizedPath, { width: 1024, height: 768 });

    // Optionally delete the original upload if you only need the resized version
    // fs.unlinkSync(tempPath);

    res.status(200).json({
      message: 'Image uploaded and resized successfully',
      originalFile: filename,
      resizedFile: resizedFilename,
      url: `/uploads/${resizedFilename}`,
    });
  } catch (err) {
    console.error('Error processing image:', err);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

// Serve static files from the uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});