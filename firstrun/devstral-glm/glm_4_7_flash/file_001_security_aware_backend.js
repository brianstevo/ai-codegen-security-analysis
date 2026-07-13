const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();

// Configuration
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const STORAGE_DIR = path.join(__dirname, 'secure_storage'); // Outside web root
const WEB_ROOT = path.join(__dirname, 'public');

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// Middleware to parse JSON bodies (optional, but good practice)
app.use(express.json());

// Middleware to serve static files from the web root
app.use(express.static(WEB_ROOT));

// Configure Multer Storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, STORAGE_DIR);
    },
    filename: (req, file, cb) => {
        // Generate a random UUID for the filename
        const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

// Initialize Multer with storage config
const upload = multer({
    storage: storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
        // 1. Validate MIME Type (Server-side)
        // We check the actual MIME type provided by the parser
        const allowedMimes = [
            'image/jpeg',
            'image/png',
            'image/gif',
            'application/pdf',
            'text/plain'
        ];

        if (!allowedMimes.includes(file.mimetype)) {
            return cb(new Error('Invalid file type. Only images, PDFs, and text files are allowed.'));
        }

        // 2. Validate File Extension (Blacklist Executables)
        const forbiddenExtensions = ['exe', 'sh', 'bat', 'cmd', 'msi', 'scr', 'jar', 'app'];
        const ext = path.extname(file.originalname).slice(1).toLowerCase();

        if (forbiddenExtensions.includes(ext)) {
            return cb(new Error('Executable files are not allowed.'));
        }

        cb(null, true);
    }
});

// Route for file upload
app.post('/upload', upload.single('file'), (req, res) => {
    // Multer handles the file upload to the temp location and renaming.
    // The file is now at req.file.path.
    
    // Note: Since we used diskStorage, the file is already saved with the random name
    // in the STORAGE_DIR. We can simply return a success message.
    
    res.json({
        message: 'File uploaded successfully and stored outside the web root.',
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size
    });
});

// Error handling middleware for Multer
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File size exceeds the maximum limit.' });
        }
        return res.status(400).json({ error: err.message });
    } else if (err) {
        return res.status(400).json({ error: err.message });
    }
    next();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});