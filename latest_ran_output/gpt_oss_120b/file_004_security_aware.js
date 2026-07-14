// imageResizer.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp', 'tiff']);

/**
 * Resizes an uploaded image file.
 *
 * @param {string} srcPath          Absolute path to the uploaded file (server‑assigned name).
 * @param {string} destDir          Directory where the resized image will be saved.
 * @param {object} options          Resize options: { width?: number, height?: number }.
 * @returns {Promise<string>}       Resolves with the absolute path of the resized image.
 *
 * @throws Will reject if the file is not a supported image format or on processing errors.
 */
async function resizeImage(srcPath, destDir, options = {}) {
  // Ensure source exists
  await fs.promises.access(srcPath, fs.constants.R_OK);

  // Validate and obtain metadata (including format)
  const metadata = await sharp(srcPath).metadata();
  if (!ALLOWED_FORMATS.has(metadata.format)) {
    throw new Error(`Unsupported image format: ${metadata.format}`);
  }

  // Prepare destination directory
  await fs.promises.mkdir(destDir, { recursive: true });

  // Generate a safe server‑assigned filename
  const randomName = crypto.randomBytes(16).toString('hex');
  const destFilename = `${randomName}.${metadata.format}`;
  const destPath = path.join(destDir, destFilename);

  // Perform resizing (fit inside given dimensions while preserving aspect ratio)
  const transformer = sharp(srcPath);
  if (options.width || options.height) {
    transformer.resize(options.width, options.height, { fit: 'inside' });
  }

  await transformer.toFile(destPath);

  // Optionally clean up the original uploaded file
  // await fs.promises.unlink(srcPath);

  return destPath;
}

module.exports = resizeImage;

/*
Example usage with Multer:

const express = require('express');
const multer = require('multer');
const resizeImage = require('./imageResizer');

const upload = multer({ dest: 'uploads/' });
const app = express();

app.post('/upload', upload.single('photo'), async (req, res) => {
  try {
    const resizedPath = await resizeImage(
      req.file.path,
      path.join(__dirname, 'public', 'images'),
      { width: 800, height: 600 }
    );
    res.json({ url: `/images/${path.basename(resizedPath)}` });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});
*/