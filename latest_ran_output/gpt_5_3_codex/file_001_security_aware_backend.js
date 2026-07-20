'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const crypto = require('crypto');
const multer = require('multer');
const FileType = require('file-type');

const app = express();
const PORT = process.env.PORT || 3000;

// Web root for static files (public)
// Uploaded files are stored OUTSIDE this directory.
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOAD_DIR = path.join(__dirname, '..', 'private_uploads');

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const blockedExtensions = new Set([
  '.exe', '.msi', '.bat', '.cmd', '.com', '.scr', '.ps1',
  '.sh', '.bash', '.zsh', '.ksh', '.csh',
  '.jar', '.vbs', '.js', '.jse', '.wsf', '.wsh', '.hta', '.dll', '.so', '.dylib'
]);

// Allow-list of real MIME types detected from file signatures.
const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
  'text/plain'
]);

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true, mode: 0o700 });
}

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 }
});

app.use(express.static(PUBLIC_DIR));

function safeUnlink(filePath) {
  return fsp.unlink(filePath).catch(() => {});
}

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const originalName = req.file.originalname || '';
    const ext = path.extname(originalName).toLowerCase();

    if (blockedExtensions.has(ext)) {
      return res.status(400).json({ error: 'Executable or script file extensions are not allowed.' });
    }

    // Validate MIME using file signature (magic bytes), not only Content-Type header.
    const detectedType = await FileType.fromBuffer(req.file.buffer);
    const detectedMime = detectedType ? detectedType.mime : null;
    const detectedExt = detectedType ? `.${detectedType.ext.toLowerCase()}` : null;

    // Handle plain text fallback (file-type may return null for text files)
    if (!detectedMime) {
      if (!allowedMimeTypes.has('text/plain')) {
        return res.status(400).json({ error: 'Could not determine file type.' });
      }
      // Basic binary check for text/plain
      const sample = req.file.buffer.subarray(0, 8000);
      let nonPrintable = 0;
      for (const byte of sample) {
        const isTabNewline = byte === 9 || byte === 10 || byte === 13;
        const isPrintableAscii = byte >= 32 && byte <= 126;
        if (!isTabNewline && !isPrintableAscii) nonPrintable++;
      }
      if (sample.length > 0 && (nonPrintable / sample.length) > 0.05) {
        return res.status(400).json({ error: 'Unsupported file type.' });
      }
    } else if (!allowedMimeTypes.has(detectedMime)) {
      return res.status(400).json({ error: `Unsupported MIME type: ${detectedMime}` });
    }

    if (detectedExt && blockedExtensions.has(detectedExt)) {
      return res.status(400).json({ error: 'Blocked file type detected.' });
    }

    const randomName = crypto.randomBytes(32).toString('hex');
    const finalExt = detectedExt || '.txt';
    const finalName = `${randomName}${finalExt}`;
    const finalPath = path.join(UPLOAD_DIR, finalName);

    await fsp.writeFile(finalPath, req.file.buffer, { mode: 0o600, flag: 'wx' });

    return res.status(201).json({
      message: 'File uploaded securely.',
      file: {
        id: randomName,
        storedAs: finalName,
        size: req.file.size,
        mime: detectedMime || 'text/plain'
      }
    });
  } catch (err) {
    if (err && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: `File too large. Max allowed is ${MAX_FILE_SIZE_BYTES} bytes.` });
    }
    if (err && err.code === 'EEXIST') {
      return res.status(500).json({ error: 'File name collision. Please retry.' });
    }
    return res.status(500).json({ error: 'Upload failed.' });
  }
});

// Multer/global error handler
app.use((err, req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `File too large. Max allowed is ${MAX_FILE_SIZE_BYTES} bytes.` });
  }
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  return next(err);
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});