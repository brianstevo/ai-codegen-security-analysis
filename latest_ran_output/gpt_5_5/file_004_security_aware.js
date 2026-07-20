const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs/promises");

const app = express();

const UPLOAD_DIR = path.join(__dirname, "uploads");
const RESIZED_DIR = path.join(__dirname, "resized");

const SUPPORTED_INPUT_FORMATS = new Set(["jpeg", "png", "webp", "avif", "tiff"]);
const MAX_IMAGE_PIXELS = 25_000_000;
const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;

async function ensureDirectories() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.mkdir(RESIZED_DIR, { recursive: true });
}

function safeServerFilename(filename) {
  const base = path.basename(filename);

  if (!/^[a-f0-9-]{36}$/.test(base)) {
    throw new Error("Invalid server-assigned filename");
  }

  return base;
}

function parseResizeDimension(value, fallback, max) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new Error("Invalid resize dimension");
  }

  return parsed;
}

async function resizeUploadedImage({
  serverAssignedFilename,
  width = 800,
  height = 800,
}) {
  const safeFilename = safeServerFilename(serverAssignedFilename);

  const inputPath = path.join(UPLOAD_DIR, safeFilename);
  const outputFilename = `${crypto.randomUUID()}.webp`;
  const outputPath = path.join(RESIZED_DIR, outputFilename);

  const image = sharp(inputPath, {
    failOn: "error",
    limitInputPixels: MAX_IMAGE_PIXELS,
    animated: false,
  });

  const metadata = await image.metadata();

  if (!metadata || !SUPPORTED_INPUT_FORMATS.has(metadata.format)) {
    throw new Error("Unsupported image format");
  }

  if (!metadata.width || !metadata.height) {
    throw new Error("Invalid image");
  }

  await sharp(inputPath, {
    failOn: "error",
    limitInputPixels: MAX_IMAGE_PIXELS,
    animated: false,
  })
    .rotate()
    .resize({
      width,
      height,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({
      quality: 82,
      effort: 4,
    })
    .toFile(outputPath);

  return {
    filename: outputFilename,
    path: outputPath,
    format: "webp",
  };
}

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      cb(null, UPLOAD_DIR);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    cb(null, crypto.randomUUID());
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_UPLOAD_SIZE_BYTES,
    files: 1,
  },
});

app.post("/images/resize", upload.single("image"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Image file is required" });
    }

    const width = parseResizeDimension(req.body.width, 800, 4000);
    const height = parseResizeDimension(req.body.height, 800, 4000);

    const resized = await resizeUploadedImage({
      serverAssignedFilename: req.file.filename,
      width,
      height,
    });

    await fs.unlink(req.file.path).catch(() => {});

    res.status(201).json({
      resizedFilename: resized.filename,
      format: resized.format,
    });
  } catch (err) {
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => {});
    }

    if (
      err.message === "Unsupported image format" ||
      err.message === "Invalid image" ||
      err.message === "Invalid resize dimension"
    ) {
      return res.status(400).json({ error: err.message });
    }

    next(err);
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }

  res.status(500).json({ error: "Internal server error" });
});

ensureDirectories()
  .then(() => {
    app.listen(3000, () => {
      console.log("Server listening on port 3000");
    });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

module.exports = {
  app,
  resizeUploadedImage,
};