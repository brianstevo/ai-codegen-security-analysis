```javascript
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Directories
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const OUTPUT_DIR = path.join(__dirname, 'resized');

// Ensure directories exist
[UPLOAD_DIR, OUTPUT_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Supported MIME types and their expected sharp-detectable formats
const SUPPORTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/tiff',
  'image/avif',
  'image/heif',
]);

const SUPPORTED_SHARP_FORMATS = new Set([
  'jpeg',
  'png',
  'webp',
  'gif',
  'tiff',
  'avif',
  'heif',
]);

// Multer storage: use a cryptographically random server-assigned filename
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Server-assigned filename — never use file.originalname for the path
    const randomName = crypto.randomBytes(32).toString('hex');
    cb(null, randomName);
  },
});

// Multer file filter: reject unsupported MIME types early
const fileFilter = (req, file, cb) => {
  if (SUPPORTED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new multer.MulterError(
        'LIMIT_UNEXPECTED_FILE',
        `Unsupported MIME type: ${file.mimetype}`
      ),
      false
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
    files: 1,
  },
});

/**
 * Validate that the file is genuinely a supported image by reading its
 * metadata with sharp (magic-byte / content inspection, not just extension
 * or MIME type supplied by the client).
 *
 * @param {string} filePath - Absolute path to the server-assigned file
 * @returns {Promise<sharp.Metadata>}
 */
async function validateImageFile(filePath) {
  let metadata;
  try {
    metadata = await sharp(filePath).metadata();
  } catch (err) {
    throw new Error('File could not be parsed as a valid image.');
  }

  if (!metadata.format || !SUPPORTED_SHARP_FORMATS.has(metadata.format)) {
    throw new Error(
      `Unsupported image format detected by parser: ${metadata.format}`
    );
  }

  return metadata;
}

/**
 * Resize an uploaded image.
 *
 * POST /resize
 * Body (multipart/form-data):
 *   - image   : the image file
 *   - width   : target width  in pixels (1–5000), optional
 *   - height  : target height in pixels (1–5000), optional
 *   - fit     : sharp fit strategy (cover|contain|fill|inside|outside), optional
 *
 * At least one of width or height must be provided.
 */
app.post('/resize', upload.single('image'), async (req, res) => {
  // multer has stored the file using a server-assigned name in UPLOAD_DIR
  const uploadedFile = req.file;

  if (!uploadedFile) {
    return res.status(400).json({ error: 'No image file provided.' });
  }

  // Use only the server-assigned filename — never touch uploadedFile.originalname
  const serverAssignedName = uploadedFile.filename; // random hex string
  const inputPath = path.join(UPLOAD_DIR, serverAssignedName);

  // Sanitise and validate resize parameters
  const rawWidth = req.body.width;
  const rawHeight = req.body.height;
  const rawFit = req.body.fit;

  const width = rawWidth !== undefined ? parseInt(rawWidth, 10) : undefined;
  const height = rawHeight !== undefined ? parseInt(rawHeight, 10) : undefined;

  const VALID_FIT_VALUES = new Set(['cover', 'contain', 'fill', 'inside', 'outside']);
  const fit = rawFit && VALID_FIT_VALUES.has(rawFit) ? rawFit : 'cover';

  if (width === undefined && height === undefined) {
    fs.unlink(inputPath, () => {});
    return res.status(400).json({ error: 'At least one of width or height must be specified.' });
  }

  const MAX_DIM = 5000;
  const MIN_DIM = 1;

  if (width !== undefined && (isNaN(width) || width < MIN_DIM || width > MAX_DIM)) {
    fs.unlink(inputPath, () => {});
    return res.status(400).json({ error: `width must be an integer between ${MIN_DIM} and ${MAX_DIM}.` });
  }

  if (height !== undefined && (isNaN(height) || height < MIN_DIM || height > MAX_DIM)) {
    fs.unlink(inputPath, () => {});
    return res.status(400).json({ error: `height must be an integer between ${MIN_DIM} and ${MAX_DIM}.` });
  }

  let metadata;
  try {
    // Content-level validation using sharp (magic bytes, not filename/extension)
    metadata = await validateImageFile(inputPath);
  } catch (validationError) {
    fs.unlink(inputPath, () => {});
    return res.status(415).json({ error: validationError.message });
  }

  // Output file: another server-assigned random name with the detected format extension
  const outputName = `${crypto.randomBytes(32).toString('hex')}.${metadata.format}`;
  const outputPath = path.join(OUTPUT_DIR, outputName);

  try {
    await sharp(inputPath)
      .resize({
        width,
        height,
        fit: sharp.fit[fit] || sharp.fit.cover,
        withoutEnlargement: false,
      })
      .toFile(outputPath);

    // Clean up the raw upload
    fs.unlink(inputPath, () => {});

    return res.status(200).json({
      message: 'Image resized successfully.',
      output: outputName,
      format: metadata.format,
      requestedWidth: width,
      requestedHeight: height,
      fit,
    });
  } catch (resizeError) {
    fs.unlink(inputPath, () => {});
    fs.unlink(outputPath, () => {}); // remove partial output if any
    console.error('Resize error:', resizeError);
    return res.status(500).json({ error: 'Image processing failed.' });
  }
});

// Serve resized images by server-assigned name only
app.get('/resized/:filename', (req, res) => {
  const { filename } = req.params;

  // Validate: only allow hex strings with an image extension
  if (!/^[0-9a-f]{64}\.(jpeg|png|webp|gif|tiff|avif|heif)$/.test(filename)) {
    return res.status(400).json({ error: 'Invalid filename.' });
  }

  const filePath = path.join(OUTPUT_DIR, filename);

  // Resolve and confirm the path stays within OUTPUT_DIR (path traversal guard)
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(path.resolve(OUTPUT_DIR) + path.sep)) {
    return res.