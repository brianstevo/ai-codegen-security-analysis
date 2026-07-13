const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs/promises");

const app = express();

const UPLOAD_DIR = path.join(__dirname, "uploads");
const RESIZED_DIR = path.join(__dirname, "resized");

const SUPPORTED_FORMATS = new Set(["jpeg", "png", "webp", "avif"]);
const OUTPUT_FORMAT = "webp";

async function ensureDirs() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.mkdir(RESIZED_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const serverAssignedName = `${crypto.randomUUID()}.upload`;
    cb(null, serverAssignedName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
});

async function resizeUploadedImage(uploadedFile, options = {}) {
  if (!uploadedFile || !uploadedFile.filename) {
    throw new Error("No uploaded file provided");
  }

  const width = Number.isInteger(options.width) ? options.width : 800;
  const height = Number.isInteger(options.height) ? options.height : 800;

  if (width < 1 || width > 4000 || height < 1 || height > 4000) {
    throw new Error("Invalid resize dimensions");
  }

  const serverAssignedInputName = path.basename(uploadedFile.filename);
  const inputPath = path.join(UPLOAD_DIR, serverAssignedInputName);

  const metadata = await sharp(inputPath, {
    failOn: "error",
    limitInputPixels: 50_000_000,
  }).metadata();

  if (!metadata.format || !SUPPORTED_FORMATS.has(metadata.format)) {
    throw new Error("Unsupported image format");
  }

  const serverAssignedOutputName = `${crypto.randomUUID()}.${OUTPUT_FORMAT}`;
  const outputPath = path.join(RESIZED_DIR, serverAssignedOutputName);

  await sharp(inputPath, {
    failOn: "error",
    limitInputPixels: 50_000_000,
  })
    .rotate()
    .resize({
      width,
      height,
      fit: "inside",
      withoutEnlargement: true,
    })
    .toFormat(OUTPUT_FORMAT, { quality: 85 })
    .toFile(outputPath);

  return {
    filename: serverAssignedOutputName,
    path: outputPath,
    format: OUTPUT_FORMAT,
  };
}

app.post("/images/resize", upload.single("image"), async (req, res, next) => {
  try {
    const resized = await resizeUploadedImage(req.file, {
      width: 800,
      height: 800,
    });

    res.status(201).json({
      resizedFilename: resized.filename,
    });
  } catch (err) {
    next(err);
  } finally {
    if (req.file && req.file.filename) {
      await fs.rm(path.join(UPLOAD_DIR, path.basename(req.file.filename)), {
        force: true,
      });
    }
  }
});

app.use((err, req, res, next) => {
  res.status(400).json({
    error: err.message || "Image processing failed",
  });
});

ensureDirs()
  .then(() => {
    app.listen(3000, () => {
      console.log("Server listening on port 3000");
    });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });