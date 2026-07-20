"use strict";

const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs/promises");
const fsSync = require("fs");

const app = express();

const PORT = Number(process.env.PORT || 3000);
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const PUBLIC_DIR = path.resolve(__dirname, "public");
const UPLOAD_DIR = path.resolve(__dirname, "..", "private_uploads");

const relativeUploadToPublic = path.relative(PUBLIC_DIR, UPLOAD_DIR);
if (!relativeUploadToPublic || (!relativeUploadToPublic.startsWith("..") && !path.isAbsolute(relativeUploadToPublic))) {
  throw new Error("UPLOAD_DIR must be outside the public web root.");
}

fsSync.mkdirSync(UPLOAD_DIR, {
  recursive: true,
  mode: 0o700
});

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf"
]);

const ALLOWED_EXTENSIONS_BY_MIME = {
  "image/png": new Set([".png"]),
  "image/jpeg": new Set([".jpg", ".jpeg"]),
  "image/gif": new Set([".gif"]),
  "image/webp": new Set([".webp"]),
  "application/pdf": new Set([".pdf"])
};

const EXECUTABLE_EXTENSIONS = new Set([
  ".exe",
  ".dll",
  ".bat",
  ".cmd",
  ".com",
  ".scr",
  ".msi",
  ".msp",
  ".ps1",
  ".psm1",
  ".vbs",
  ".vbe",
  ".js",
  ".jse",
  ".mjs",
  ".cjs",
  ".wsf",
  ".wsh",
  ".hta",
  ".sh",
  ".bash",
  ".zsh",
  ".fish",
  ".ksh",
  ".csh",
  ".run",
  ".bin",
  ".app",
  ".apk",
  ".jar",
  ".war",
  ".ear",
  ".php",
  ".phtml",
  ".phar",
  ".pl",
  ".py",
  ".pyc",
  ".pyo",
  ".rb",
  ".cgi",
  ".deb",
  ".rpm",
  ".dmg",
  ".pkg"
]);

app.disable("x-powered-by");

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

app.use(express.static(PUBLIC_DIR, {
  index: "index.html",
  dotfiles: "deny",
  setHeaders(res) {
    res.setHeader("X-Content-Type-Options", "nosniff");
  }
}));

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function hasExecutableExtension(originalName) {
  const baseName = path.basename(String(originalName || "")).toLowerCase();
  const extensionParts = baseName
    .split(".")
    .slice(1)
    .map((part) => `.${part}`);

  return extensionParts.some((extension) => EXECUTABLE_EXTENSIONS.has(extension));
}

function extensionMatchesMime(originalName, detectedMime) {
  const extension = path.extname(path.basename(String(originalName || ""))).toLowerCase();
  const allowedExtensions = ALLOWED_EXTENSIONS_BY_MIME[detectedMime];

  return Boolean(allowedExtensions && allowedExtensions.has(extension));
}

async function safeUnlink(filePath) {
  if (!filePath) return;

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Failed to delete file:", error);
    }
  }
}

async function detectMimeFromMagicBytes(filePath) {
  const handle = await fs.open(filePath, "r");

  try {
    const buffer = Buffer.alloc(4100);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const bytes = buffer.subarray(0, bytesRead);

    if (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    ) {
      return "image/png";
    }

    if (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    ) {
      return "image/jpeg";
    }

    if (
      bytes.length >= 6 &&
      (bytes.subarray(0, 6).toString("ascii") === "GIF87a" ||
        bytes.subarray(0, 6).toString("ascii") === "GIF89a")
    ) {
      return "image/gif";
    }

    if (
      bytes.length >= 12 &&
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP"
    ) {
      return "image/webp";
    }

    if (
      bytes.length >= 5 &&
      bytes.subarray(0, 5).toString("ascii") === "%PDF-"
    ) {
      return "application/pdf";
    }

    return "application/octet-stream";
  } finally {
    await handle.close();
  }
}

const storage = multer.diskStorage({
  destination(req, file, callback) {
    callback(null, UPLOAD_DIR);
  },
  filename(req, file, callback) {
    crypto.randomBytes(32, (error, buffer) => {
      if (error) {
        callback(error);
        return;
      }

      callback(null, buffer.toString("hex"));
    });
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
    fields: 0,
    parts: 1
  },
  fileFilter(req, file, callback) {
    if (hasExecutableExtension(file.originalname)) {
      callback(httpError(400, "Executable file extensions are not allowed."));
      return;
    }

    callback(null, true);
  }
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true
  });
});

app.post("/api/upload", upload.single("file"), async (req, res, next) => {
  let savedPath;

  try {
    if (!req.file) {
      res.status(400).json({
        ok: false,
        error: "No file was uploaded."
      });
      return;
    }

    savedPath = req.file.path;

    await fs.chmod(savedPath, 0o600);

    if (req.file.size > MAX_FILE_SIZE) {
      await safeUnlink(savedPath);
      res.status(413).json({
        ok: false,
        error: "File is too large."
      });
      return;
    }

    const detectedMime = await detectMimeFromMagicBytes(savedPath);

    if (!ALLOWED_MIME_TYPES.has(detectedMime)) {
      await safeUnlink(savedPath);
      res.status(415).json({
        ok: false,
        error: "Unsupported or unrecognized file type."
      });
      return;
    }

    if (!extensionMatchesMime(req.file.originalname, detectedMime)) {
      await safeUnlink(savedPath);
      res.status(415).json({
        ok: false,
        error: "File extension does not match the detected file type."
      });
      return;
    }

    res.status(201).json({
      ok: true,
      message: "File uploaded successfully.",
      file: {
        id: req.file.filename,
        originalName: path.basename(req.file.originalname),
        size: req.file.size,
        detectedMime
      }
    });
  } catch (error) {
    await safeUnlink(savedPath);
    next(error);
  }
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({
        ok: false,
        error: "File is too large."
      });
      return;
    }

    res.status(400).json({
      ok: false,
      error: error.message
    });
    return;
  }

  const status = Number(error.status || 500);

  if (status >= 500) {
    console.error(error);
  }

  res.status(status).json({
    ok: false,
    error: status >= 500 ? "Internal server error." : error.message
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});