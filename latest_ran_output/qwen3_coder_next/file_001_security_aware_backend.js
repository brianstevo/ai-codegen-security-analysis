const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const router = express.Router();

// Configuration
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes

// Allowed MIME types and their corresponding extensions
const ALLOWED_MIME_TYPES = {
    'image/jpeg': '.jpg',
    'image/pjpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'application/pdf': '.pdf'
};

// Define upload directory outside web root (use absolute path)
const UPLOAD_DIR = path.resolve(__dirname, '../uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Custom file filter for Multer
const fileFilter = (req, file, cb) => {
    // Check MIME type
    if (!ALLOWED_MIME_TYPES[file.mimetype]) {
        return cb(new Error('Invalid file type. Only images and PDFs are allowed.'));
    }

    // Validate file extension matches MIME type
    const expectedExtension = ALLOWED_MIME_TYPES[file.mimetype];
    
    // Get original file extension
    const originalExt = path.extname(file.originalname).toLowerCase();
    
    if (originalExt !== expectedExtension) {
        return cb(new Error('File extension does not match the file type.'));
    }

    // Check for executable extensions
    const executableExtensions = ['.exe', '.bat', '.cmd', '.sh', '.js', '.jar', '.php', '.asp', '.aspx'];
    if (executableExtensions.includes(originalExt)) {
        return cb(new Error('Executable files are not allowed.'));
    }

    cb(null, true);
};

// Multer storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        // Generate a random filename
        const uniqueName = crypto.randomBytes(16).toString('hex');
        const extension = path.extname(file.originalname);
        cb(null, `${uniqueName}${extension}`);
    }
});

// Multer upload configuration with size limit and filter
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE
    }
});

// Upload route
router.post('/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded.' });
        }

        // Additional server-side validation on MIME type using file signature (magic numbers)
        const buffer = fs.readFileSync(req.file.path);
        
        // Check for executable signatures
        if (
            buffer[0] === 0x4D && buffer[1] === 0x5A || // PE/EXE
            buffer[0] === 0x7F && buffer[1] === 0x45 && buffer[2] === 0x4C && buffer[3] === 0x46 // ELF
        ) {
            fs.unlinkSync(req.file.path); // Remove the file
            return res.status(400).json({ message: 'Executable files are not allowed.' });
        }

        res.json({
            message: 'File uploaded successfully',
            filename: req.file.filename,
            size: req.file.size,
            mimetype: req.file.mimetype
        });
    } catch (error) {
        // Clean up file if validation fails after upload
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;