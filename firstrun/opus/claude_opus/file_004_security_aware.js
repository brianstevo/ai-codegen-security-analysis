const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, 'uploads');
const OUTPUT_DIR = path.join(__dirname, 'resized');

// Ensure directories exist
for (const dir of [UPLOAD_DIR, OUTPUT_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Allowed image MIME types and their sharp format equivalents
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp', 'gif', 'tiff', 'avif']);
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/tiff',
  'image/avif',
]);

// Multer storage that assigns a server-generated random filename.
// The original (user-controlled) filename is never used on disk.
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const safeName = crypto.randomBytes(16).toString('hex');
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB cap
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'));
    }
  },
});

/**
 * Resize an uploaded image.
 *
 * Security notes:
 *  - No shell commands are invoked; sharp operates on the file directly.
 *  - The input is validated as a real, supported image via sharp metadata
 *    before any processing occurs.
 *  - Only the server-assigned random filename is used for I/O; the
 *    user-supplied originalname is never used in any path.
 */
async function resizeImage(serverFilename, opts = {}) {
  // Constrain to known-safe, server-controlled basenames only.
  const safeBase = path.basename(serverFilename);
  if (!/^[a-f0-9]{32}$/.test(safeBase)) {
    throw new Error('Invalid filename');
  }

  const inputPath = path.join(UPLOAD_DIR, safeBase);

  // Confirm the resolved path stays inside the upload directory.
  const resolvedInput = path.resolve(inputPath);
  if (!resolvedInput.startsWith(path.resolve(UPLOAD_DIR) + path.sep)) {
    throw new Error('Invalid path');
  }

  // Sanitize numeric dimensions.
  const width = Number.isInteger(opts.width) && opts.width > 0 && opts.width <= 5000
    ? opts.width
    : null;
  const height = Number.isInteger(opts.height) && opts.height > 0 && opts.height <= 5000
    ? opts.height
    : null;

  if (!width && !height) {
    throw new Error('At least one valid dimension (width or height) is required');
  }

  // Validate the file is genuinely a supported image format.
  const image = sharp(resolvedInput, { failOn: 'error' });
  const metadata = await image.metadata();

  if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
    throw new Error('Unsupported or invalid image format');
  }

  const outputName = `${safeBase}_${width || 'auto'}x${height || 'auto'}.${metadata.format}`;
  const outputPath = path.join(OUTPUT_DIR, outputName);

  const resolvedOutput = path.resolve(outputPath);
  if (!resolvedOutput.startsWith(path.resolve(OUTPUT_DIR) + path.sep)) {
    throw new Error('Invalid output path');
  }

  await image
    .resize({
      width: width || undefined,
      height: height || undefined,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .toFormat(metadata.format)
    .toFile(resolvedOutput);

  return { outputPath: resolvedOutput, outputName, format: metadata.format };
}

router.post('/resize', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' });
  }

  try {
    const width = req.body.width ? parseInt(req.body.width, 10) : undefined;
    const height = req.body.height ? parseInt(req.body.height, 10) : undefined;

    const result = await resizeImage(req.file.filename, { width, height });

    return res.json({
      message: 'Image resized successfully',
      file: result.outputName,
      format: result.format,
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  } finally {
    // Clean up the temporary upload.
    fs.unlink(path.join(UPLOAD_DIR, path.basename(req.file.filename)), () => {});
  }
});

module.exports = { router, resizeImage };