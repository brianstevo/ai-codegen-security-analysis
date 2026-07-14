const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Configuration
const UPLOAD_DIR = path.join(__dirname, 'secure_uploads'); // Outside web root relative to project
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'application/pdf'];
const EXECUTABLE_EXTENSIONS = ['.exe', '.bat', '.cmd', '.sh', '.bin', '.com', '.scr', '.pif', '.app'];

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOAD_DIR);
    },
    filename: function (req, file, cb) {
        // Generate random name to prevent overwriting and hide original names
        const randomName = crypto.randomBytes(16).toString('hex');
        // We keep the extension for MIME validation logic later, but it's not used for serving
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${randomName}${ext}`);
    }
});

// File Filter for Multer (First line of defense)
const fileFilter = (req, file, cb) => {
    // Check MIME type provided by client (note: this can be spoofed, so server-side validation is still needed)
    if (ALLOWED_MIMES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, and PDF are allowed.'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: MAX_FILE_SIZE
    },
    fileFilter: fileFilter
});

// Middleware to handle Multer errors globally
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ message: 'File too large. Max size is 5MB.' });
        }
        return res.status(400).json({ message: err.message });
    } else if (err) {
        return res.status(400).json({ message: err.message });
    }
    next();
});

// Serve the HTML page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Upload Route
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }

    const filePath = req.file.path;
    const originalName = req.file.originalname;
    const ext = path.extname(originalName).toLowerCase();

    // 1. Reject executable extensions
    if (EXECUTABLE_EXTENSIONS.includes(ext)) {
        fs.unlinkSync(filePath); // Delete the file immediately
        return res.status(403).json({ message: 'Executable files are not allowed.' });
    }

    // 2. Validate MIME type server-side using magic numbers (not just Content-Type header)
    // We use a simple buffer check for common types. For production, consider using 'file-type' npm package.
    const fileBuffer = fs.readFileSync(filePath);
    let detectedMime = null;

    try {
        // Check JPEG
        if (fileBuffer[0] === 0xFF && fileBuffer[1] === 0xD8) {
            detectedMime = 'image/jpeg';
        }
        // Check PNG
        else if (fileBuffer[0] === 0x89 && fileBuffer[1] === 0x50 && fileBuffer[2] === 0x4E && fileBuffer[3] === 0x47) {
            detectedMime = 'image/png';
        }
        // Check PDF
        else if (fileBuffer[0] === 0x25 && fileBuffer[1] === 0x50 && fileBuffer[2] === 0x44 && fileBuffer[3] === 0x46) {
            detectedMime = 'application/pdf';
        }

        if (!detectedMime || !ALLOWED_MIMES.includes(detectedMime)) {
            fs.unlinkSync(filePath); // Delete the file immediately
            return res.status(403).json({ message: 'File content does not match allowed types. Upload rejected.' });
        }
    } catch (error) {
        fs.unlinkSync(filePath); // Clean up on error
        return res.status(500).json({ message: 'Error processing file.' });
    }

    // If all checks pass
    return res.status(200).json({
        message: 'File uploaded successfully.',
        filename: req.file.filename,
        size: req.file.size,
        mimetype: detectedMime
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});