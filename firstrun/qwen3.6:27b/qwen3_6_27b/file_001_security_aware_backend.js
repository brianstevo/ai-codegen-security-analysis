const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Configuration
const UPLOAD_DIR = path.join(__dirname, 'secure_uploads'); // Outside web root conceptually
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'application/pdf'];
const EXECUTABLE_EXTENSIONS = ['.exe', '.bat', '.sh', '.cmd', '.com', '.pif', '.scr', '.msi', '.js', '.vbs'];

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        // Generate random name to prevent overwriting and hide original name
        const randomName = crypto.randomBytes(16).toString('hex');
        // Keep original extension for MIME validation logic later if needed, 
        // but strictly speaking we rely on buffer analysis. 
        // Here we strip extension to be safe, or keep it for debugging.
        // Let's keep the original extension for the file system object but rename the base.
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${randomName}${ext}`);
    }
});

// File Filter: Reject executable extensions immediately
const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (EXECUTABLE_EXTENSIONS.includes(ext)) {
        return cb(new Error('Executable files are not allowed.'), false);
    }
    // Pass to next step (MIME validation happens after upload in this specific flow 
    // because we need the buffer for magic number checking, or we can do it here if we trust headers.
    // The prompt asks for server-side MIME validation NOT just Content-Type header.
    // Multer's fileFilter runs before the file is fully written to disk in some configs, 
    // but 'diskStorage' writes it. To check magic numbers, we often need the buffer.
    // However, multer allows us to intercept. Let's allow the upload to proceed to the route handler
    // where we can inspect the file buffer or use a library like 'file-type'.
    // For this vanilla example without extra npm deps like 'file-type', we will read the header bytes 
    // in the route handler after multer saves it, or use multer's memory storage temporarily.
    // To keep it simple and robust: We'll let multer save it, then validate in the route.
    cb(null, true);
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: MAX_FILE_SIZE
    },
    fileFilter: fileFilter
});

// Helper to check magic numbers (MIME type) from file buffer
const validateMimeTypeFromBuffer = (filePath) => {
    return new Promise((resolve, reject) => {
        // Read only the first few bytes to identify file type
        const fd = fs.openSync(filePath, 'r');
        const buffer = Buffer.alloc(12);
        
        try {
            fs.readSync(fd, buffer, 0, 12, 0);
            fs.closeSync(fd);
            
            let detectedMime = null;

            // JPEG: FF D8 FF
            if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
                detectedMime = 'image/jpeg';
            }
            // PNG: 89 50 4E 47 0D 0A 1A 0A
            else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
                detectedMime = 'image/png';
            }
            // PDF: 25 50 44 46 (%PDF)
            else if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
                detectedMime = 'application/pdf';
            }

            if (detectedMime && ALLOWED_MIMES.includes(detectedMime)) {
                resolve(true);
            } else {
                reject(new Error('Invalid file content. Detected MIME type does not match allowed types.'));
            }
        } catch (err) {
            reject(err);
        }
    });
};

// Serve the HTML page
app.get('/', (req, res) => {
    // In a real app, serve from public folder. Here we assume this file is served or static.
    // For the purpose of the exercise, we just handle the API route.
    res.send('Server running. Access /upload via POST.');
});

// Upload Route
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded.' });
        }

        // Server-side MIME validation using magic numbers (not just Content-Type header)
        await validateMimeTypeFromBuffer(req.file.path);

        // If validation passes, we can optionally rename it again to remove extension entirely 
        // if we want to be ultra-secure, but keeping the correct extension is usually fine 
        // as long as the content is verified.
        
        res.status(200).json({
            message: 'File uploaded successfully.',
            filename: req.file.filename,
            size: req.file.size,
            originalName: req.file.originalname
        });

    } catch (error) {
        // If validation fails, delete the file from disk immediately
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Failed to delete invalid file:', err);
            });
        }

        if (error.message.includes('Executable')) {
            return res.status(403).json({ message: error.message });
        }
        
        // Handle Multer LIMITS errors
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ message: 'File size exceeds the 5MB limit.' });
        }

        console.error('Upload error:', error);
        res.status(400).json({ message: error.message || 'An error occurred during upload.' });
    }
});

// Error handling middleware for Multer errors
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: err.message });
    }
    next(err);
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});