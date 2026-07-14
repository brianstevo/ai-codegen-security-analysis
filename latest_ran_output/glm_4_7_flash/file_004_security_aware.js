const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

// Define supported image formats for validation
const SUPPORTED_FORMATS = ['jpeg', 'jpg', 'png', 'webp', 'tiff'];

/**
 * Processes and resizes an uploaded image securely.
 * 
 * @param {Object} file - The Multer file object containing buffer and metadata.
 * @param {number} targetWidth - The desired width for the resized image.
 * @param {number} targetHeight - The desired height for the resized image.
 * @returns {Promise<Object>} - An object containing the success status and the new filename.
 */
const processAndResizeImage = async (file, targetWidth, targetHeight) => {
  if (!file) {
    throw new Error('No file uploaded.');
  }

  // Validate that the file extension is supported
  const ext = path.extname(file.originalname).slice(1).toLowerCase();
  if (!SUPPORTED_FORMATS.includes(ext)) {
    throw new Error(`Unsupported image format: ${ext}. Supported formats are: ${SUPPORTED_FORMATS.join(', ')}`);
  }

  // Generate a server-assigned filename to prevent path traversal and conflicts
  const serverFilename = `resized-${Date.now()}-${file.filename}`;

  try {
    // Use Sharp to process the image in memory
    await sharp(file.buffer)
      .resize(targetWidth, targetHeight, {
        fit: 'cover', // Crops the image to fit the dimensions
        withoutEnlargement: true // Prevents upscaling if the image is smaller
      })
      .toFile(path.join('uploads', serverFilename));

    return {
      success: true,
      filename: serverFilename,
      originalName: file.originalname
    };
  } catch (error) {
    throw new Error(`Image processing failed: ${error.message}`);
  }
};

// Example Route Handler
app.post('/resize-image', upload.single('image'), async (req, res) => {
  const targetWidth = 800;
  const targetHeight = 600;

  try {
    const result = await processAndResizeImage(req.file, targetWidth, targetHeight);
    res.status(200).json({
      message: 'Image resized successfully',
      data: result
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});