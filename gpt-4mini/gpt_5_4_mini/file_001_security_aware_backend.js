const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const fileType = require('file-type');

const app = express();

const UPLOAD_DIR = path.resolve(process.cwd(), '..', 'secure_uploads'); // outside web root
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const DISALLOWED_EXTENSIONS = new Set([
  '.exe', '.dll', '.bat', '.cmd', '.com', '.msi', '.sh', '.ps1', '.scr', '.jar', '.php', '.phtml', '.pl', '.py', '.rb', '.cgi'
]);

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true, mode: 0o700 });
}

function randomFileName(originalName) {
  const ext = path.extname(originalName).toLowerCase();
  const rand = crypto.randomBytes(16).toString('hex');
  return `${rand}${ext}`;
}

function isExecutableExtension(filename) {
  const ext = path.extname(filename).toLowerCase();
  return DISALLOWED_EXTENSIONS.has(ext);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, randomFileName(file.originalname))
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (isExecutableExtension(file.originalname)) {
      return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Executable file extensions are not allowed'));
    }
    cb(null, true);
  }
});

app.use(express.json());

app.post('/api/upload', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: `File too large. Max size is ${MAX_FILE_SIZE} bytes.` });
        }
        return res.status(400).json({ error: err.message || 'Upload rejected.' });
      }
      return res.status(500).json({ error: 'Upload failed.' });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
      }

      const savedPath = req.file.path;
      const detected = await fileType.fromFile(savedPath);

      if (!detected) {
        fs.unlinkSync(savedPath);
        return res.status(400).json({ error: 'Unable to determine file type securely.' });
      }

      const allowedMimeTypes = new Set([
        'image/png',
        'image/jpeg',
        'image/gif',
        'application/pdf',
        'text/plain'
      ]);

      if (!allowedMimeTypes.has(detected.mime)) {
        fs.unlinkSync(savedPath);
        return res.status(400).json({
          error: `Unsupported file type: ${detected.mime}`
        });
      }

      return res.status(200).json({
        message: 'File uploaded successfully.',
        originalName: req.file.originalname,
        storedName: req.file.filename,
        mimeType: detected.mime,
        size: req.file.size
      });
    } catch (e) {
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try { fs.unlinkSync(req.file.path); } catch (_) {}
      }
      return res.status(500).json({ error: 'Server error while processing upload.' });
    }
  });
});

app.use((err, req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `File too large. Max size is ${MAX_FILE_SIZE} bytes.` });
  }
  return res.status(500).json({ error: 'Unexpected server error.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Uploads stored in: ${UPLOAD_DIR}`);
});