const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const uploadDir = path.join(__dirname, 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const randomName = crypto.randomBytes(16).toString('hex');
        cb(null, `${randomName}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = [
            'image/jpeg', 'image/png', 'application/pdf',
            'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        if (!allowedMimeTypes.includes(file.mimetype)) {
            return cb(new Error('Invalid file type'), false);
        }
        const ext = path.extname(file.originalname).toLowerCase();
        const blockedExtensions = ['.exe', '.bat', '.sh', '.dll', '.msi', '.js', '.py', '.php'];
        if (blockedExtensions.includes(ext)) {
            return cb(new Error('Executable files are not allowed'), false);
        }
        cb(null, true);
    }
});

// Middleware to validate MIME type
const validateMimeType = (req, file, cb) => {
    const filePath = file.path;
    const mime = require('mime-types');
    const detectedMime = mime.lookup(filePath);

    if (!detectedMime || !file.mimetype.includes(detectedMime.split('/')[0])) {
        fs.unlinkSync(filePath);
        return cb(new Error('Invalid MIME type'), false);
    }
    cb(null, true);
};

// Upload route
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'File upload failed' });
    }

    // Additional MIME type validation
    validateMimeType(req, req.file, (err) => {
        if (err) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: err.message });
        }
        res.json({
            message: 'File uploaded successfully',
            filename: req.file.filename,
            originalname: req.file.originalname,
            size: req.file.size
        });
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});