const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

// Supported MIME types for image processing
const SUPPORTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
  'image/gif'
];

/**
 * Resizes an uploaded image using sharp.
 * 
 * @param {string} sourcePath - The path to the uploaded file on the server.
 * @param {string} destinationPath - The path where the resized image should be saved.
 * @param {number} width - The target width for the resized image.
 * @param {number} height - The target height for the resized image.
 * @returns {Promise<string>} - The path to the resized image.
 */
async function resizeImage(sourcePath, destinationPath, width, height) {
  // Validate that source file exists
  try {
    await fs.access(sourcePath);
  } catch (error) {
    throw new Error('Source file does not exist or is inaccessible.');
  }

  // Read the first few bytes to determine MIME type using sharp's metadata detection
  // This avoids relying on file extensions which can be spoofed
  let metadata;
  try {
    metadata = await sharp(sourcePath).metadata();
  } catch (error) {
    throw new Error('Invalid image format or corrupted file.');
  }

  // Validate that the detected MIME type is supported
  if (!metadata || !SUPPORTED_MIME_TYPES.includes(metadata.format)) {
    throw new Error(`Unsupported image format: ${metadata ? metadata.format : 'unknown'}`);
  }

  // Ensure width and height are positive integers
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new Error('Width and height must be positive integers.');
  }

  // Generate a secure server-assigned filename to prevent path traversal or overwriting
  const uniqueFilename = crypto.randomBytes(16).toString('hex') + path.extname(destinationPath);
  const safeDestinationPath = path.join(path.dirname(destinationPath), uniqueFilename);

  try {
    // Resize the image using sharp
    await sharp(sourcePath)
      .resize(width, height, {
        fit: 'cover', // Use 'cover' to maintain aspect ratio and fill dimensions
        position: 'center'
      })
      .toFile(safeDestinationPath);

    return safeDestinationPath;
  } catch (error) {
    throw new Error('Failed to resize image.');
  }
}

module.exports = { resizeImage };