// server.js
const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;
const { fileTypeFromBuffer } = require('file-type');

const app = express();
const PORT = process.env.PORT || 3000;

// Directory outside the web root
const UPLOAD_DIR = path.join(__dirname, '..', 'secure_uploads');

// Ensure upload directory exists
(async () => {
    try {
        await fs.mkdir(UPLOAD_DIR, { recursive: true });
    } catch (e) {
        console.error('Failed to create upload dir:', e);
        process.exit(1);
    }
})();

// Multer config – store in memory for validation before writing to disk
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5 MB limit
});

const REJECTED_EXTENSIONS = new Set([
    '.exe', '.bat', '.cmd', '.sh', '.js', '.php', '.py', '.pl',
    '.jar', '.msi', '.dll', '.scr', '.pif'
]);

app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded.' });
        }

        // Validate MIME type using file-type library (checks actual bytes)
        const detected = await fileTypeFromBuffer(req.file.buffer);
        if (!detected) {
            return res.status(400).json({ success: false, message: 'Unable to determine file type.' });
        }

        const allowedMimeTypes = new Set([
            'image/jpeg',
            'image/png',
            'image/gif',
            'application/pdf',
            'text/plain'
        ]);

        if (!allowedMimeTypes.has(detected.mime)) {
            return res.status(400).json({ success: false, message: `Disallowed MIME type: ${detected.mime}` });
        }

        // Reject dangerous extensions regardless of MIME
        const originalExt = path.extname(req.file.originalname).toLowerCase();
        if (REJECTED_EXTENSIONS.has(originalExt)) {
            return res.status(400).json({ success: false, message: `File extension ${originalExt} is not allowed.` });
        }

        // Generate a random filename preserving the safe extension
        const randomName = crypto.randomBytes(16).toString('hex') + originalExt;
        const destPath = path.join(UPLOAD_DIR, randomName);

        // Write file to disk
        await fs.writeFile(destPath, req.file.buffer, { mode: 0o600 });

        return res.json({ success: true, filename: randomName });
    } catch (err) {
        console.error('Upload error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});