// server.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Directory outside the web root (ensure it exists)
const UPLOAD_DIR = path.join(__dirname, '..', 'secure-uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Allowed MIME types and forbidden extensions
const ALLOWED_MIME = [
    'image/jpeg',
    'image/png',
    'application/pdf',
    'text/plain'
];
const FORBIDDEN_EXT = new Set(['.exe', '.bat', '.cmd', '.sh', '.js', '.php', '.py']);

// Multer storage configuration (in memory for validation)
const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
    fileFilter: (req, file, cb) => {
        // Validate MIME type
        if (!ALLOWED_MIME.includes(file.mimetype)) {
            return cb(new Error('Invalid file type.'));
        }

        // Validate extension against blacklist
        const ext = path.extname(file.originalname).toLowerCase();
        if (FORBIDDEN_EXT.has(ext)) {
            return cb(new Error('Executable files are not allowed.'));
        }

        cb(null, true);
    }
}).single('file');

// Route to handle upload
app.post('/upload', (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ success: false, message: err.message });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file provided.' });
        }

        try {
            // Generate a random filename preserving original extension
            const randomName = crypto.randomBytes16 ? crypto.randomBytes(16).toString('hex') : Date.now().toString();
            const ext = path.extname(req.file.originalname).toLowerCase();
            const finalName = `${randomName}${ext}`;
            const destPath = path.join(UPLOAD_DIR, finalName);

            // Write file to disk
            await fs.promises.writeFile(destPath, req.file.buffer);

            res.json({
                success: true,
                message: 'File uploaded successfully.',
                filename: finalName,
                size: req.file.size,
                mimeType: req.file.mimetype
            });
        } catch (writeErr) {
            console.error(writeErr);
            res.status(500).json({ success: false, message: 'Server error while saving file.' });
        }
    });
});

// Serve the static HTML page (adjust path as needed)
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});