const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, 'uploads');
const OUTPUT_DIR = path.join(__dirname, 'resized');

// Ensure directories exist
[UPLOAD_DIR, OUTPUT_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Allowed MIME types and their sharp-compatible formats
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp', 'gif', 'tiff', 'avif']);
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/tiff',
  'image/avif',
]);

// Generate a random, server-assigned filename (no user input used)
function generateServerFilename() {
  return crypto.randomBytes(16).toString('hex');
}

// Multer storage using only server-assigned filenames
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Ignore the original filename entirely; assign our own name.
    cb(null, generateServerFilename());
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    // Preliminary check on declared MIME type
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error('Unsupported image format'));
    }
    cb(null, true);
  },
});

/**
 * Resizes an uploaded image.
 *
 * - Never passes user-controlled values into shell commands.
 * - Uses the sharp library directly.
 * - Validates that the input is a genuinely supported image format
 *   (by inspecting file metadata, not trusting the declared type).
 * - Operates on the server-assigned filename, never the original filename.
 */
async function resizeUploadedImage(serverFilename, width, height) {
  // Resolve and confine the input path to the upload directory to prevent traversal.
  const inputPath = path.join(UPLOAD_DIR, path.basename(serverFilename));
  const resolvedInput = path.resolve(inputPath);
  if (!resolvedInput.startsWith(path.resolve(UPLOAD_DIR) + path.sep)) {
    throw new Error('Invalid input path');
  }

  // Validate that the file is actually a supported image by reading its metadata.
  const image = sharp(resolvedInput, { failOn: 'error' });
  const metadata = await image.metadata();

  if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
    throw new Error('Unsupported or invalid image format');
  }

  // Sanitize dimensions to safe integer bounds.
  const safeWidth = Math.min(Math.max(parseInt(width, 10) || 0, 1), 5000) || null;
  const safeHeight = Math.min(Math.max(parseInt(height, 10) || 0, 1), 5000) || null;

  if (!safeWidth && !safeHeight) {
    throw new Error('At least one valid dimension is required');
  }

  // Build a server-assigned output filename.
  const outputName = `${generateServerFilename()}.${metadata.format}`;
  const outputPath = path.join(OUTPUT_DIR, outputName);

  await image
    .resize({
      width: safeWidth,
      height: safeHeight,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .toFormat(metadata.format)
    .toFile(outputPath);

  return { outputName, outputPath, format: metadata.format };
}

// Route handler
router.post('/resize', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' });
  }

  const { width, height } = req.body;

  try {
    const result = await resizeUploadedImage(req.file.filename, width, height);

    // Clean up the original upload.
    fs.unlink(path.join(UPLOAD_DIR, req.file.filename), () => {});

    return res.json({
      message: 'Image resized successfully',
      file: result.outputName,
      format: result.format,
    });
  } catch (err) {
    // Clean up on failure.
    fs.unlink(path.join(UPLOAD_DIR, req.file.filename), () => {});
    return res.status(400).json({ error: err.message });
  }
});

module.exports = { router, resizeUploadedImage };