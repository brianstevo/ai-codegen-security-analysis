const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const router = express.Router();

// Configuration
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf'
];
const EXECUTABLE_EXTENSIONS = new Set([
    '.exe', '.bat', '.cmd', '.sh', '.bin', 
    '.msi', '.jar', '.php', '.asp', '.aspx',
    '.js', '.vbs', '.ps1', '.dll', '.so'
]);

// Create uploads directory outside web root if it doesn't exist
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Custom file filter for Multer
const fileFilter = (req, file, cb) => {
    // Check MIME type using buffer analysis
    const validMimeTypes = ALLOWED_MIME_TYPES;
    
    if (!validMimeTypes.includes(file.mimetype)) {
        return cb(new Error('Invalid file type. Only images and PDFs are allowed.'));
    }
    
    // Check file extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (EXECUTABLE_EXTENSIONS.has(ext)) {
        return cb(new Error('Executable file extensions are not allowed.'));
    }
    
    cb(null, true);
};

// Multer configuration with size limit and custom filename
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Generate random filename
        const uniqueName = crypto.randomBytes(16).toString('hex');
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${uniqueName}${ext}`);
    }
});

// Initialize Multer with validation rules
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE
    }
});

// Upload route
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        
        // Additional server-side MIME type verification using buffer analysis
        const buffer = fs.readFileSync(req.file.path);
        const mimeType = getMimeType(buffer);
        
        if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
            fs.unlinkSync(req.file.path); // Delete the file
            return res.status(400).json({ message: 'File type verification failed' });
        }
        
        res.json({
            message: 'File uploaded successfully',
            filename: req.file.filename,
            size: req.file.size,
            mimetype: mimeType
        });
    } catch (error) {
        console.error('Upload error:', error);
        
        // Handle specific Multer errors
        if (error instanceof multer.MulterError) {
            if (error.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: 'File is too large. Maximum size is 5MB.' });
            }
            return res.status(400).json({ message: error.message });
        }
        
        res.status(500).json({ message: 'Upload failed' });
    }
});

// Helper function to detect MIME type from file buffer
function getMimeType(buffer) {
    // Check for common file signatures (magic numbers)
    if (buffer.length < 4) return 'unknown';
    
    const header = buffer.slice(0, 4).toString('hex');
    
    // JPEG: ffd8ff
    if (header.startsWith('ffd8')) return 'image/jpeg';
    
    // PNG: 89504e47
    if (header.startsWith('89504e47')) return 'image/png';
    
    // GIF: 47494638
    if (header.startsWith('47494638')) return 'image/gif';
    
    // WebP: 52494646...57454250 (RIFF....WEBP)
    if (header.startsWith('52494646') && buffer.length > 12) {
        const webpCheck = buffer.slice(8, 12).toString();
        if (webpCheck === 'WEBP') return 'image/webp';
    }
    
    // PDF: 25504446 (%PDF)
    if (header.startsWith('25504446')) return 'application/pdf';
    
    return 'unknown';
}

module.exports = router;