const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

// Configuration
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const UPLOAD_DIR = path.join(__dirname, 'secure_storage'); // Outside web root (relative to app)
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf'];
const FORBIDDEN_EXTENSIONS = ['.exe', '.sh', '.bat', '.cmd', '.js', '.php', '.py'];

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer storage configuration for random renaming and secure pathing
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const randomName = crypto.randomBytes(16).toString('hex');
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${randomName}${ext}`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: MAX_SIZE } 
}).single('file');

/**
 * Validates file magic numbers to ensure the MIME type is correct
 * regardless of the provided extension or Content-Type header.
 */
function validateMagicNumbers(filePath) {
    const buffer = Buffer.alloc(4);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 4, 0);
    fs.closeSync(fd);

    const hex = buffer.toString('hex').toUpperCase();

    // JPEG: FF D8 FF
    if (hex.startsWith('FFD8FF')) return 'image/jpeg';
    // PNG: 89 50 4E 47
    if (hex.startsWith('89504E47')) return 'image/png';
    // PDF: 25 50 44 46 (%PDF)
    if (hex.startsWith('25504446')) return 'application/pdf';

    return null;
}

app.post('/upload', (req, res) => {
    upload(req, res, async (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: 'File too large. Max 5MB allowed.' });
            }
            return res.status(400).json({ message: err.message });
        } else if (err) {
            return res.status(500).json({ message: 'Internal server error' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded.' });
        }

        const filePath = req.file.path;
        const originalName = req.file.originalname;
        const ext = path.extname(originalName).toLowerCase();

        try {
            // 1. Reject executable extensions explicitly
            if (FORBIDDEN_EXTENSIONS.includes(ext)) {
                throw new Error('Executable files are strictly prohibited.');
            }

            // 2. Ensure extension is in our allowed list
            if (!ALLOWED_EXTENSIONS.includes(ext)) {
                throw new Error('Unsupported file extension.');
            }

            // 3. Server-side MIME validation via Magic Numbers (Content-Type header ignored)
            const actualMime = validateMagicNumbers(filePath);
            if (!actualMime) {
                throw new Error('File content does not match its extension (Invalid File Type).');
            }

            res.status(200).json({ 
                message: 'File uploaded securely and validated successfully.' 
            });

        } catch (error) {
            // Delete the file if validation fails to prevent storage of malicious files
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            res.status(400).json({ message: error.message });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Files stored securely in: ${UPLOAD_DIR}`);
});