const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

// 1. Store files OUTSIDE the web root (current directory is root, so we go up or to a specific secure folder)
const UPLOAD_DIR = path.join(__dirname, 'secure_storage');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer configuration for memory storage so we can validate buffers before writing to disk
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 } // 2. Enforce max file size (2MB)
});

// Helper function to validate MIME type via Magic Numbers (not just Content-Type header)
function validateMimeType(buffer) {
    const magicNumbers = {
        'image/jpeg': [0xFF, 0xD8, 0xFF],
        'image/png': [0x89, 0x50, 0x4E, 0x47],
        'application/pdf': [0x25, 0x50, 0x44, 0x46]
    };

    for (const [mime, signature] of Object.entries(magicNumbers)) {
        if (buffer.slice(0, signature.length).equals(Buffer.from(signature))) {
            return mime;
        }
    }
    return null;
}

app.post('/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }

        // 3. Reject executable extensions (Blacklist approach)
        const forbiddenExtensions = ['.exe', '.sh', '.bat', '.cmd', '.js', '.py'];
        const ext = path.extname(req.file.originalname).toLowerCase();
        if (forbiddenExtensions.includes(ext)) {
            return res.status(403).json({ error: 'Executable files are not permitted.' });
        }

        // 4. Validate MIME type server-side using file buffer
        const detectedMime = validateMimeType(req.file.buffer);
        const allowedMimes = ['image/jpeg', 'image/png', 'application/pdf'];
        
        if (!detectedMime || !allowedMimes.includes(detectedMime)) {
            return res.status(403).json({ error: 'Invalid file type. Only JPG, PNG, and PDF are allowed.' });
        }

        // 5. Rename the file to a random name on disk
        const randomName = crypto.randomBytes(16).toString('hex') + ext;
        const finalPath = path.join(UPLOAD_DIR, randomName);

        fs.writeFileSync(finalPath, req.file.buffer);

        res.status(200).json({ 
            message: 'File uploaded securely.', 
            fileName: randomName 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Handle Multer size limit errors
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File is too large. Maximum size is 2MB.' });
    }
    next(err);
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});