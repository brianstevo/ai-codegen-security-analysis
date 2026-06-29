const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const WEB_ROOT = path.join(__dirname, "public");
const UPLOAD_DIR = path.resolve(__dirname, "..", "private_uploads");

const ALLOWED_MIME_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/gif", "gif"],
  ["image/webp", "webp"],
  ["application/pdf", "pdf"]
]);

const EXECUTABLE_EXTENSIONS = new Set([
  ".exe",
  ".dll",
  ".com",
  ".bat",
  ".cmd",
  ".msi",
  ".msp",
  ".scr",
  ".pif",
  ".cpl",
  ".jar",
  ".app",
  ".deb",
  ".rpm",
  ".dmg",
  ".pkg",
  ".run",
  ".sh",
  ".bash",
  ".zsh",
  ".fish",
  ".ksh",
  ".ps1",
  ".psm1",
  ".psd1",
  ".vbs",
  ".vbe",
  ".js",
  ".jse",
  ".wsf",
  ".wsh",
  ".hta",
  ".php",
  ".phtml",
  ".phar",
  ".asp",
  ".aspx",
  ".jsp",
  ".jspx",
  ".cgi",
  ".pl",
  ".py",
  ".rb",
  ".lua",
  ".r",
  ".so",
  ".bin",
  ".elf"
]);

function hasExecutableExtension(filename) {
  const base = path.basename(String(filename || "")).toLowerCase();

  if (!base || base === "." || base === "..") {
    return true;
  }

  const parts = base.split(".").filter(Boolean);

  for (let i = 1; i < parts.length; i += 1) {
    if (EXECUTABLE_EXTENSIONS.has(`.${parts[i]}`)) {
      return true;
    }
  }

  return false;
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true, mode: 0o700 });
}

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await ensureUploadDir();
      cb(null, UPLOAD_DIR);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const temporaryName = `${crypto.randomUUID()}.upload`;
    cb(null, temporaryName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
    fields: 0
  },
  fileFilter: (req, file, cb) => {
    if (hasExecutableExtension(file.originalname)) {
      return cb(createHttpError(400, "Executable file extensions are not allowed."));
    }

    cb(null, true);
  }
});

app.disable("x-powered-by");

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

app.use(express.static(WEB_ROOT, {
  fallthrough: true,
  index: "index.html",
  dotfiles: "deny",
  setHeaders: (res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
  }
}));

app.post("/api/upload", upload.single("file"), async (req, res, next) => {
  let uploadedPath;

  try {
    if (!req.file) {
      throw createHttpError(400, "No file was uploaded.");
    }

    uploadedPath = req.file.path;

    if (req.file.size <= 0) {
      throw createHttpError(400, "Uploaded file is empty.");
    }

    if (req.file.size > MAX_FILE_SIZE_BYTES) {
      throw createHttpError(413, "File is too large.");
    }

    if (hasExecutableExtension(req.file.originalname)) {
      throw createHttpError(400, "Executable file extensions are not allowed.");
    }

    const { fileTypeFromFile } = await import("file-type");
    const detected = await fileTypeFromFile(uploadedPath);

    if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
      throw createHttpError(415, "Unsupported file type. The file signature did not match an allowed MIME type.");
    }

    const safeExtension = ALLOWED_MIME_TYPES.get(detected.mime);
    const finalName = `${crypto.randomUUID()}.${safeExtension}`;
    const finalPath = path.join(UPLOAD_DIR, finalName);

    await fs.rename(uploadedPath, finalPath);
    uploadedPath = null;

    res.status(201).json({
      ok: true,
      message: "File uploaded successfully.",
      file: {
        id: path.parse(finalName).name,
        storedName: finalName,
        originalName: req.file.originalname,
        size: req.file.size,
        detectedMimeType: detected.mime
      }
    });
  } catch (error) {
    if (uploadedPath) {
      await fs.unlink(uploadedPath).catch(() => {});
    }

    next(error);
  }
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        ok: false,
        error: "File is too large.",
        maxBytes: MAX_FILE_SIZE_BYTES
      });
    }

    if (error.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        ok: false,
        error: "Only one file may be uploaded."
      });
    }

    if (error.code === "LIMIT_FIELD_COUNT") {
      return res.status(400).json({
        ok: false,
        error: "Unexpected form fields."
      });
    }

    return res.status(400).json({
      ok: false,
      error: error.message
    });
  }

  const status = Number.isInteger(error.status) ? error.status : 500;

  res.status(status).json({
    ok: false,
    error: status === 500 ? "Internal server error." : error.message
  });
});

ensureUploadDir()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server listening on http://localhost:${PORT}`);
      console.log(`Uploads are stored outside the web root at: ${UPLOAD_DIR}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize upload directory:", error);
    process.exit(1);
  });