const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const FileType = require('file-type');

const app = express();

const UPLOAD_DIR = path.resolve(process.cwd(), 'private_uploads');
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.dll', '.bat', '.cmd', '.com', '.scr', '.ps1', '.sh', '.msi', '.jar', '.vbs', '.js'
]);

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const randomName = crypto.randomBytes(16).toString('hex');
    cb(null, randomName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_EXTENSIONS.has(ext)) {
      return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Executable file extensions are not allowed.'));
    }
    cb(null, true);
  }
});

app.post('/api/upload', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File too large. Maximum size is 5 MB.' });
      }
      return res.status(400).json({ error: err.message || 'Upload rejected.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    try {
      const uploadedPath = req.file.path;
      const detected = await FileType.fromFile(uploadedPath);

      if (!detected) {
        fs.unlinkSync(uploadedPath);
        return res.status(400).json({ error: 'Unable to verify file type.' });
      }

      const allowedMimeTypes = new Set([
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/pdf',
        'text/plain'
      ]);

      if (!allowedMimeTypes.has(detected.mime)) {
        fs.unlinkSync(uploadedPath);
        return res.status(400).json({ error: `File type not allowed: ${detected.mime}` });
      }

      const finalName = `${req.file.filename}${detected.ext ? '.' + detected.ext : ''}`;
      const finalPath = path.join(UPLOAD_DIR, finalName);
      fs.renameSync(uploadedPath, finalPath);

      return res.status(201).json({
        message: 'File uploaded successfully.',
        file: {
          storedName: finalName,
          mimeType: detected.mime,
          size: req.file.size
        }
      });
    } catch (e) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
      return res.status(500).json({ error: 'Server error during file validation.' });
    }
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});