'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const crypto = require('crypto');
const FileType = require('file-type');

const app = express();
const PORT = process.env.PORT || 3000;

// Public web root (for static HTML, etc.)
const WEB_ROOT = path.join(__dirname, 'public');

// Store uploads outside web root
const UPLOAD_DIR = path.join(__dirname, '..', 'private_uploads');

// Max file size (e.g., 5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Explicitly blocked executable/scripting extensions
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.msi', '.bat', '.cmd', '.com', '.scr', '.pif', '.cpl', '.jar',
  '.js', '.jse', '.vbs', '.vbe', '.wsf', '.wsh', '.ps1', '.psm1', '.psd1',
  '.hta', '.reg', '.dll', '.so', '.dylib', '.sh', '.bash', '.zsh', '.ksh',
  '.apk', '.app', '.deb', '.rpm', '.bin', '.run'
]);

// Allow-list of safe detected MIME types
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain'
]);

// Memory storage so we can inspect true file signature before writing to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE }
});

async function ensureUploadDir() {
  await fsp.mkdir(UPLOAD_DIR, { recursive: true, mode: 0o700 });
}

function randomName(bytes = 16) {
  return crypto.randomBytes(bytes).toString('hex');
}

app.use(express.static(WEB_ROOT, { index: 'index.html' }));

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const originalName = req.file.originalname || '';
    const originalExt = path.extname(originalName).toLowerCase();

    if (BLOCKED_EXTENSIONS.has(originalExt)) {
      return res.status(400).json({ error: 'File extension is not allowed.' });
    }

    // Detect real MIME from magic bytes/content, not request header alone
    const detected = await FileType.fromBuffer(req.file.buffer);

    let detectedMime = null;
    let detectedExt = null;

    if (detected) {
      detectedMime = detected.mime;
      detectedExt = `.${detected.ext.toLowerCase()}`;
    } else {
      // Some plain text files may not be recognized by file-type
      // Basic utf-8 text heuristic fallback
      const asUtf8 = req.file.buffer.toString('utf8');
      const reEncoded = Buffer.from(asUtf8, 'utf8');
      const isLikelyText = reEncoded.length === req.file.buffer.length || req.file.mimetype === 'text/plain';

      if (isLikelyText) {
        detectedMime = 'text/plain';
        detectedExt = '.txt';
      }
    }

    if (!detectedMime || !ALLOWED_MIME_TYPES.has(detectedMime)) {
      return res.status(400).json({ error: 'Unsupported or untrusted file type.' });
    }

    // Use detected extension when possible, otherwise safe fallback
    const safeExt = detectedExt || '.dat';

    // Ensure the final extension is not blocked
    if (BLOCKED_EXTENSIONS.has(safeExt)) {
      return res.status(400).json({ error: 'Detected extension is not allowed.' });
    }

    await ensureUploadDir();

    const filename = `${randomName(16)}${safeExt}`;
    const finalPath = path.join(UPLOAD_DIR, filename);

    // 'wx' prevents overwriting if somehow collision occurs
    await fsp.writeFile(finalPath, req.file.buffer, { flag: 'wx', mode: 0o600 });

    return res.status(201).json({
      message: 'File uploaded securely.',
      storedAs: filename,
      size: req.file.size,
      mime: detectedMime
    });
  } catch (err) {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: `File too large. Max ${MAX_FILE_SIZE} bytes.` });
    }
    if (err && err.code === 'EEXIST') {
      return res.status(500).json({ error: 'Filename collision, please retry.' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `File too large. Max ${MAX_FILE_SIZE} bytes.` });
  }
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error.' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});