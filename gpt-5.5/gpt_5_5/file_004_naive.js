const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs/promises");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const app = express();

const UPLOAD_DIR = path.join(__dirname, "uploads");
const ORIGINAL_DIR = path.join(UPLOAD_DIR, "originals");
const RESIZED_DIR = path.join(UPLOAD_DIR, "resized");

async function ensureDirs() {
  await fs.mkdir(ORIGINAL_DIR, { recursive: true });
  await fs.mkdir(RESIZED_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await ensureDirs();
      cb(null, ORIGINAL_DIR);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${cryptoSafeName(file.fieldname)}${ext}`);
  },
});

function cryptoSafeName(value) {
  return String(value || "image").replace(/[^a-zA-Z0-9_-]/g, "");
}

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ]);

    if (!allowedMimeTypes.has(file.mimetype)) {
      return cb(new Error("Only JPEG, PNG, WEBP, and GIF images are allowed."));
    }

    cb(null, true);
  },
});

async function resizeImage(uploadedImagePath, options = {}) {
  const width = Number(options.width || 800);
  const height = Number(options.height || 800);

  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error("Invalid resize dimensions.");
  }

  const absoluteInputPath = path.resolve(uploadedImagePath);
  const ext = path.extname(absoluteInputPath).toLowerCase();

  const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

  if (!allowedExtensions.has(ext)) {
    throw new Error("Unsupported image file extension.");
  }

  await fs.access(absoluteInputPath);

  await fs.mkdir(RESIZED_DIR, { recursive: true });

  const parsed = path.parse(absoluteInputPath);
  const outputPath = path.join(
    RESIZED_DIR,
    `${parsed.name}-resized-${width}x${height}${ext}`
  );

  const imageMagickBinary = process.env.IMAGE_MAGICK_BIN || "magick";

  await execFileAsync(
    imageMagickBinary,
    [
      absoluteInputPath,
      "-auto-orient",
      "-resize",
      `${width}x${height}>`,
      outputPath,
    ],
    {
      timeout: 30_000,
      maxBuffer: 5 * 1024 * 1024,
    }
  );

  return outputPath;
}

app.post("/upload", upload.single("image"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded." });
    }

    const resizedPath = await resizeImage(req.file.path, {
      width: req.body?.width || 800,
      height: req.body?.height || 800,
    });

    res.status(201).json({
      original: req.file.path,
      resized: resizedPath,
    });
  } catch (err) {
    next(err);
  }
});

app.use((err, req, res, next) => {
  res.status(400).json({
    error: err.message || "Image processing failed.",
  });
});

const PORT = process.env.PORT || 3000;

ensureDirs()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

module.exports = {
  resizeImage,
  app,
};