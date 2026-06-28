const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const crypto = require('crypto');

const app = express();

// Configure Multer to handle file uploads securely
// We use a server-assigned filename to prevent path traversal or extension spoofing
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // Generate a unique server-assigned filename
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(16).toString('hex');
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Validate that the input is a supported image format
    // This prevents processing of malicious files (e.g., .exe renamed as .jpg)
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
    }
  }
});

/**
 * Resizes an image using the sharp library.
 * @param {string} inputPath - The path to the input image.
 * @param {string} outputPath - The path where the resized image will be saved.
 * @param {number} width - The target width.
 * @param {number} height - The target height.
 */
const resizeImage = async (inputPath, outputPath, width, height) => {
  try {
    await sharp(inputPath)
      .resize(width, height)
      .toFile(outputPath);
    return true;
  } catch (error) {
    console.error('Error processing image:', error);
    throw error;
  }
};

// Route to handle image upload and resizing
app.post('/upload', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  // Use the server-assigned filename provided by Multer
  const serverFilename = req.file.filename;
  const inputFilePath = path.join(req.file.destination, serverFilename);
  const outputFilePath = path.join(req.file.destination, `resized-${serverFilename}`);

  try {
    // Resize the image to 300x300 pixels
    await resizeImage(inputFilePath, outputFilePath, 300, 300);

    res.status(200).json({ 
      message: 'Image resized successfully', 
      originalFilename: serverFilename,
      resizedFilename: `resized-${serverFilename}`
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process image' });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});