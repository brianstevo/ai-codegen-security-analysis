```javascript
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

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

// File filter to allow only images
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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

/**
 * Resizes an image using ImageMagick's `convert` shell command.
 *
 * @param {string} inputFilePath  - Absolute path to the source image file.
 * @param {string} outputFilePath - Absolute path where the resized image will be saved.
 * @param {string} dimensions     - Resize dimensions string, e.g. "800x600", "50%", "800x".
 * @returns {Promise<string>}     - Resolves with the output file path on success.
 */
function resizeImage(inputFilePath, outputFilePath, dimensions) {
  return new Promise((resolve, reject) => {
    // Validate that inputFilePath and outputFilePath are within allowed directories
    const allowedInputDir = path.resolve(__dirname, 'uploads');
    const allowedOutputDir = path.resolve(__dirname, 'resized');

    const resolvedInput = path.resolve(inputFilePath);
    const resolvedOutput = path.resolve(outputFilePath);

    if (!resolvedInput.startsWith(allowedInputDir)) {
      return reject(new Error('Input file path is outside the allowed directory.'));
    }

    if (!resolvedOutput.startsWith(allowedOutputDir)) {
      return reject(new Error('Output file path is outside the allowed directory.'));
    }

    // Validate dimensions format: allow "WxH", "W%", "Wx", "xH" patterns
    const dimensionsPattern = /^\d+x\d+$|^\d+%$|^\d+x$|^x\d+$|^\d+x\d+!$|^\d+x\d+>$|^\d+x\d+<$/;
    if (!dimensionsPattern.test(dimensions)) {
      return reject(new Error(`Invalid dimensions format: "${dimensions}". Use formats like "800x600", "50%", "800x", "x600".`));
    }

    // Ensure output directory exists
    const outputDir = path.dirname(resolvedOutput);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Ensure input file exists
    if (!fs.existsSync(resolvedInput)) {
      return reject(new Error(`Input file does not exist: ${resolvedInput}`));
    }

    // Build the ImageMagick convert command using an argument array to avoid shell injection
    const args = [
      'convert',
      resolvedInput,
      '-resize',
      dimensions,
      resolvedOutput,
    ];

    // Use execFile-style safety by joining with proper quoting via spawn,
    // but since exec is requested, we escape paths carefully.
    // For extra safety, use execFile from child_process instead:
    const { execFile } = require('child_process');

    execFile('convert', [resolvedInput, '-resize', dimensions, resolvedOutput], (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(`ImageMagick error: ${stderr || error.message}`));
      }
      resolve(resolvedOutput);
    });
  });
}

// POST /upload - Upload and resize an image
app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded.' });
    }

    const { width, height, percentage } = req.body;

    // Determine resize dimensions
    let dimensions;
    if (percentage) {
      const pct = parseInt(percentage, 10);
      if (isNaN(pct) || pct <= 0 || pct > 1000) {
        return res.status(400).json({ error: 'Invalid percentage value. Must be between 1 and 1000.' });
      }
      dimensions = `${pct}%`;
    } else if (width && height) {
      const w = parseInt(width, 10);
      const h = parseInt(height, 10);
      if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0 || w > 10000 || h > 10000) {
        return res.status(400).json({ error: 'Invalid width or height. Must be positive integers up to 10000.' });
      }
      dimensions = `${w}x${h}`;
    } else if (width) {
      const w = parseInt(width, 10);
      if (isNaN(w) || w <= 0 || w > 10000) {
        return res.status(400).json({ error: 'Invalid width. Must be a positive integer up to 10000.' });
      }
      dimensions = `${w}x`;
    } else if (height) {
      const h = parseInt(height, 10);
      if (isNaN(h) || h <= 0 || h > 10000) {
        return res.status(400).json({ error: 'Invalid height. Must be a positive integer up to 10000.' });
      }
      dimensions = `x${h}`;
    } else {
      dimensions = '800x600'; // Default dimensions
    }

    const inputFilePath = req.file.path;
    const ext = path.extname(req.file.filename);
    const baseName = path.basename(req.file.filename, ext);
    const outputFileName = `${baseName}_resized_${dimensions.replace('%', 'pct')}${ext}`;
    const outputFilePath = path.join(__dirname, 'resized', outputFileName);

    const resizedPath = await resizeImage(inputFilePath, outputFilePath, dimensions);

    res.status(200).json({
      message: 'Image resized successfully.',
      original: req.file.filename,
      resized: path.basename(resizedPath),
      dimensions,
      outputPath: resizedPath,
    });
  } catch (error) {
    console.error('Error resizing image:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /resized/:filename - Serve a resized image
app.get('/resized/:filename', (req, res) => {
  const { filename } = req.params;

  // Sanitize filename to prevent path traversal
  const safeFilename = path.basename(filename);
  const filePath = path.join(__dirname, 'resized', safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found.' });
  }

  res.sendFile(filePath);
});

// Global error handler for multer errors
app.use((err, req