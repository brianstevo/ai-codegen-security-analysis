const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const uploadDir = path.join(__dirname, 'secure_uploads'); // Directory outside web root

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

// Configure storage engine
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Rename file to a random name on disk
        const randomName = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, randomName + path.extname(file.originalname));
    }
});

// File Filter Middleware
const fileFilter = (req, file, cb) => {
    // 1. Reject executable file extensions
    const executableExtensions = ['.exe', '.bat', '.sh', '.cmd', '.vbs', '.js', '.jar', '.msi', '.com'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (executableExtensions.includes(ext)) {
        return cb(new Error('Executable files are not allowed.'), false);
    }

    // 2. Validate MIME type server-side
    // We check the mimetype provided by multer (derived from header) against allowed types
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'];
    if (!allowedMimes.includes(file.mimetype)) {
        return cb(new Error('Invalid file type. Only images, PDFs, and text files are allowed.'), false);
    }

    cb(null, true);
};

// Initialize Multer
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Enforce maximum file size (5MB)
    fileFilter: fileFilter
});

// Upload Route
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }
    res.json({ message: 'File uploaded successfully', filename: req.file.filename });
});

app.listen(3000, () => console.log('Server running on port 3000'));