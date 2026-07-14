const sharp = require('sharp');
const path = require('path');
const crypto = require('crypto');

// Supported MIME types for images
const SUPPORTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
];

/**
 * Resizes an uploaded image using sharp.
 * 
 * @param {string} filePath - The server-assigned path to the uploaded image file.
 * @param {number} width - The desired width for the resized image.
 * @param {number} height - The desired height for the resized image.
 * @returns {Promise<Buffer>} - A promise that resolves with the resized image buffer.
 */
async function resizeImage(filePath, width, height) {
  // Validate dimensions
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error('Invalid width or height provided.');
  }

  try {
    // Read the file metadata to validate format without processing yet
    const metadata = await sharp(filePath).metadata();

    if (!metadata.format) {
      throw new Error('Unable to determine image format.');
    }

    // Check if the format is supported by our allowed list (sharp supports many, but we restrict for security/policy)
    // Note: sharp.metadata().format returns lowercase strings like 'jpeg', 'png', etc.
    const allowedFormats = ['jpeg', 'png', 'webp', 'gif'];
    if (!allowedFormats.includes(metadata.format)) {
      throw new Error(`Unsupported image format: ${metadata.format}`);
    }

    // Perform the resize operation
    const resizedImageBuffer = await sharp(filePath)
      .resize(width, height, {
        fit: 'cover', // or 'contain', 'fill', etc. depending on requirements
        withoutEnlargement: true // Prevents upscaling if image is smaller than target
      })
      .toBuffer();

    return resizedImageBuffer;

  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('File not found.');
    }
    throw error;
  }
}

// Example usage in an Express route context:
/*
const express = require('express');
const multer = require('multer');
const fs = require('fs');

const app = express();
const uploadDir = './uploads';

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

// Configure multer to save files with server-assigned names (default behavior)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate a unique filename using crypto to avoid user-controlled filenames
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'uploaded-' + uniqueSuffix + ext);
  }
});

const upload = multer({ storage: storage });

app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No file uploaded.');
    }

    const serverAssignedPath = req.file.path;
    
    // Resize to 800x600
    const resizedBuffer = await resizeImage(serverAssignedPath, 800, 600);

    // Save the resized image or send it back
    const resizedFilename = path.basename(serverAssignedPath).replace(/\.[^/.]+$/, '') + '_resized.jpg';
    const resizedPath = path.join(uploadDir, resizedFilename);
    
    await fs.promises.writeFile(resizedPath, resizedBuffer);

    // Clean up original file if needed
    await fs.promises.unlink(serverAssignedPath);

    res.json({ message: 'Image resized successfully', filename: resizedFilename });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error processing image.');
  }
});
*/

module.exports = resizeImage;