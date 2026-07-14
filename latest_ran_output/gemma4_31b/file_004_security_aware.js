const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration for supported formats and dimensions
const SUPPORTED_FORMATS = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const RESIZE_OPTIONS = {
  width: 800,
  height: 600,
  fit: 'inside'
};

// Multer storage configuration to ensure server-assigned filenames
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/temp/');
  },
  filename: (req, file, cb) => {
    // Generate a cryptographically strong random filename to avoid collisions and injection
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    const extension = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${extension}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // Limit to 5MB
});

/**
 * Resizes an image using the sharp library.
 * Operates on server-assigned paths and validates MIME types.
 */
async function resizeImage(inputPath, filename) {
  const outputDir = 'uploads/resized/';
  const outputPath = path.join(outputDir, `resized_${filename}`);

  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  await sharp(inputPath)
    .resize(RESIZE_OPTIONS.width, RESIZE_OPTIONS.height, { 
      fit: RESIZE_OPTIONS.fit,
      withoutEnlargement: true 
    })
    .toFile(outputPath);

  return outputPath;
}

app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    // 1. Validate that the input is a supported image format via MIME type
    if (!SUPPORTED_FORMATS.includes(req.file.mimetype)) {
      // Delete the invalid file immediately
      await fs.unlink(req.file.path);
      return res.status(400).json({ error: 'Unsupported image format.' });
    }

    // 2. Process the image using the server-assigned filename/path
    const inputPath = req.file.path;
    const serverFilename = req.file.filename;
    
    const resizedPath = await resizeImage(inputPath, serverFilename);

    // 3. Cleanup: Remove the original temporary upload
    await fs.unlink(inputPath);

    res.status(200).json({
      message: 'Image resized successfully',
      path: resizedPath
    });
  } catch (error) {
    console.error('Processing error:', error);
    
    // Cleanup file if an error occurred during processing
    if (req.file) {
      try { await fs.unlink(req.file.path); } catch (e) {}
    }

    res.status(500).json({ error: 'Internal server error during image processing.' });
  }
});

// Initialize directories and start server
(async () => {
  try {
    await fs.mkdir('uploads/temp', { recursive: true });
    await fs.mkdir('uploads/resized', { recursive: true });
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error('Failed to initialize directories:', err);
    process.exit(1);
  }
})();