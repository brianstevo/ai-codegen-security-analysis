```javascript
const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = 3000;

// Directories
const UPLOAD_DIR = path.join(__dirname, "uploads");
const OUTPUT_DIR = path.join(__dirname, "resized");

// Ensure directories exist
[UPLOAD_DIR, OUTPUT_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Supported MIME types and their expected magic bytes
const SUPPORTED_FORMATS = {
  "image/jpeg": {
    magic: [0xff, 0xd8, 0xff],
    extension: ".jpg",
  },
  "image/png": {
    magic: [0x89, 0x50, 0x4e, 0x47],
    extension: ".png",
  },
  "image/webp": {
    magic: null, // Validated by checking RIFF header + WEBP marker
    extension: ".webp",
  },
  "image/gif": {
    magic: [0x47, 0x49, 0x46, 0x38],
    extension: ".gif",
  },
  "image/tiff": {
    magic: [0x49, 0x49, 0x2a, 0x00],
    extension: ".tiff",
  },
  "image/avif": {
    magic: null, // Validated by sharp metadata
    extension: ".avif",
  },
};

/**
 * Validate image magic bytes from a file buffer.
 * Returns true if the file matches a known image format signature.
 */
function validateMagicBytes(buffer, mimeType) {
  if (mimeType === "image/webp") {
    // WEBP: starts with RIFF....WEBP
    if (buffer.length < 12) return false;
    const riff =
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46;
    const webp =
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50;
    return riff && webp;
  }

  if (mimeType === "image/avif") {
    // AVIF: ftyp box with avif/avis brand — check bytes 4-11
    if (buffer.length < 12) return false;
    const ftyp =
      buffer[4] === 0x66 &&
      buffer[5] === 0x74 &&
      buffer[6] === 0x79 &&
      buffer[7] === 0x70;
    const avif =
      (buffer[8] === 0x61 &&
        buffer[9] === 0x76 &&
        buffer[10] === 0x69 &&
        buffer[11] === 0x66) ||
      (buffer[8] === 0x61 &&
        buffer[9] === 0x76 &&
        buffer[10] === 0x69 &&
        buffer[11] === 0x73);
    return ftyp && avif;
  }

  if (mimeType === "image/tiff") {
    // TIFF can be little-endian (II) or big-endian (MM)
    if (buffer.length < 4) return false;
    const littleEndian =
      buffer[0] === 0x49 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x2a &&
      buffer[3] === 0x00;
    const bigEndian =
      buffer[0] === 0x4d &&
      buffer[1] === 0x4d &&
      buffer[2] === 0x00 &&
      buffer[3] === 0x2a;
    return littleEndian || bigEndian;
  }

  const format = SUPPORTED_FORMATS[mimeType];
  if (!format || !format.magic) return false;

  if (buffer.length < format.magic.length) return false;
  return format.magic.every((byte, index) => buffer[index] === byte);
}

/**
 * Validate dimensions are safe positive integers within limits.
 */
function validateDimensions(width, height) {
  const MAX_DIMENSION = 8000;
  const MIN_DIMENSION = 1;

  const w = parseInt(width, 10);
  const h = parseInt(height, 10);

  if (isNaN(w) || isNaN(h)) {
    return { valid: false, error: "Width and height must be numbers" };
  }
  if (w < MIN_DIMENSION || h < MIN_DIMENSION) {
    return {
      valid: false,
      error: `Dimensions must be at least ${MIN_DIMENSION}px`,
    };
  }
  if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
    return {
      valid: false,
      error: `Dimensions must not exceed ${MAX_DIMENSION}px`,
    };
  }

  return { valid: true, width: w, height: h };
}

// Multer storage — server assigns the filename using crypto random bytes
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, _file, cb) => {
    // Server-assigned random filename — never uses originalname
    const randomName = crypto.randomBytes(32).toString("hex");
    cb(null, randomName);
  },
});

// Multer file filter — preliminary MIME check before saving
const fileFilter = (_req, file, cb) => {
  if (SUPPORTED_FORMATS[file.mimetype]) {
    cb(null, true);
  } else {
    cb(
      new multer.MulterError(
        "LIMIT_UNEXPECTED_FILE",
        `Unsupported file type: ${file.mimetype}`
      )
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB max
    files: 1,
  },
});

/**
 * POST /resize
 * Body (multipart/form-data):
 *   - image: the image file
 *   - width: target width (integer)
 *   - height: target height (integer)
 *   - fit: (optional) sharp fit strategy — cover|contain|fill|inside|outside
 */
app.post("/resize", upload.single("image"), async (req, res) => {
  // Server-assigned file path — never built from user-controlled values
  const uploadedFilePath = req.file ? req.file.path : null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }

    // --- 1. Validate MIME type is supported ---
    const { mimetype } = req.file;
    if (!SUPPORTED_FORMATS[mimetype]) {
      return res.status(415).json({
        error: `Unsupported image format: ${mimetype}`,
        supported: Object.keys(SUPPORTED_FORMATS),
      });
    }

    // --- 2. Validate magic bytes (file content, not just extension/MIME header) ---
    const MAGIC_BYTES_TO_READ = 16;
    const fileBuffer = Buffer.alloc(MAGIC_BYTES_TO_READ);
    const fd = fs.openSync(uploadedFilePath, "r");
    fs.readSync(fd, fileBuffer, 0, MAGIC_BYTES_TO_READ, 0);
    fs.closeSync(fd);

    if (!validateMagicBytes(fileBuffer, mimetype)) {
      return res.