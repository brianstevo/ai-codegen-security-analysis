```javascript
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure storage for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

// File filter to allow only image files
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only image files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
});

/**
 * Resizes an image using ImageMagick's `convert` shell command.
 *
 * @param {string} inputPath   - Absolute path to the source image file.
 * @param {string} outputPath  - Absolute path where the resized image will be saved.
 * @param {number} width       - Desired width in pixels.
 * @param {number} height      - Desired height in pixels.
 * @param {object} [options]   - Optional settings.
 * @param {boolean} [options.maintainAspectRatio=true] - Whether to preserve aspect ratio.
 * @param {number}  [options.quality=85]               - JPEG/WebP output quality (1–100).
 * @returns {Promise<string>}  Resolves with the output path on success.
 */
function resizeImage(inputPath, outputPath, width, height, options = {}) {
  return new Promise((resolve, reject) => {
    // --- Validate arguments ---
    if (!inputPath || typeof inputPath !== 'string') {
      return reject(new Error('inputPath must be a non-empty string.'));
    }
    if (!outputPath || typeof outputPath !== 'string') {
      return reject(new Error('outputPath must be a non-empty string.'));
    }
    if (!Number.isInteger(width) || width <= 0) {
      return reject(new Error('width must be a positive integer.'));
    }
    if (!Number.isInteger(height) || height <= 0) {
      return reject(new Error('height must be a positive integer.'));
    }

    // Resolve to absolute paths and ensure they stay within allowed directories
    const resolvedInput  = path.resolve(inputPath);
    const resolvedOutput = path.resolve(outputPath);

    const allowedDir = path.resolve(__dirname);
    if (!resolvedInput.startsWith(allowedDir) || !resolvedOutput.startsWith(allowedDir)) {
      return reject(new Error('File paths must reside within the application directory.'));
    }

    if (!fs.existsSync(resolvedInput)) {
      return reject(new Error(`Input file does not exist: ${resolvedInput}`));
    }

    // Ensure the output directory exists
    const outputDir = path.dirname(resolvedOutput);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const { maintainAspectRatio = true, quality = 85 } = options;

    // Build the geometry string:
    //   "WxH"  → fit within box, preserving aspect ratio
    //   "WxH!" → force exact dimensions
    const geometry = maintainAspectRatio ? `${width}x${height}` : `${width}x${height}!`;

    // Sanitise numeric values (already validated above, but belt-and-braces)
    const safeQuality  = Math.min(100, Math.max(1, Math.floor(quality)));

    // Use an array + shell=false equivalent via execFile would be safer,
    // but exec is used here as requested; paths are validated above.
    const escapedInput  = resolvedInput.replace(/'/g, "'\\''");
    const escapedOutput = resolvedOutput.replace(/'/g, "'\\''");

    const command = `convert '${escapedInput}' -resize '${geometry}' -quality ${safeQuality} '${escapedOutput}'`;

    exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        return reject(
          new Error(`ImageMagick error (code ${error.code}): ${stderr || error.message}`)
        );
      }
      resolve(resolvedOutput);
    });
  });
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * POST /upload
 * Accepts a multipart/form-data upload with a field named "image".
 * Query params: width, height, maintainAspectRatio, quality
 */
app.post('/upload', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided.' });
  }

  const width  = parseInt(req.query.width  || '800', 10);
  const height = parseInt(req.query.height || '600', 10);
  const maintainAspectRatio = req.query.maintainAspectRatio !== 'false';
  const quality = parseInt(req.query.quality || '85', 10);

  if (isNaN(width) || width <= 0 || isNaN(height) || height <= 0) {
    return res.status(400).json({ error: 'width and height must be positive integers.' });
  }

  const inputPath  = req.file.path;
  const ext        = path.extname(req.file.filename);
  const baseName   = path.basename(req.file.filename, ext);
  const outputDir  = path.join(__dirname, 'resized');
  const outputPath = path.join(outputDir, `${baseName}_${width}x${height}${ext}`);

  try {
    const savedPath = await resizeImage(inputPath, outputPath, width, height, {
      maintainAspectRatio,
      quality,
    });

    return res.status(200).json({
      message: 'Image resized successfully.',
      original: req.file.filename,
      resized: path.relative(__dirname, savedPath),
      dimensions: { width, height },
    });
  } catch (err) {
    console.error('Resize error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /resize
 * Resizes an already-uploaded file by filename.
 * Query params: filename (required), width, height, maintainAspectRatio, quality
 */
app.get('/resize', async (req, res) => {
  const { filename, width: w, height: h, maintainAspectRatio, quality } = req.query;

  if (!filename) {
    return res.status(400).json({ error: 'filename query parameter is required.' });
  }

  // Prevent path traversal
  const safeFilename = path.basename(filename);
  const inputPath    = path.join(__dirname, 'uploads', safeFilename);

  const width   = parseInt(w || '800', 10);
  const height  = parseInt(h || '600', 10);
  const keepAR  = maintainAsp