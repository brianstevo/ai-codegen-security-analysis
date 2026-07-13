const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration for supported formats
const SUPPORTED_FORMATS = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const UPLOAD_DIR = 'uploads/';
const PROCESSED_DIR = 'processed/';

// Ensure directories exist
async function initDirs() {
    try {
        await fs.mkdir(UPLOAD_DIR, { recursive: true });
        await fs.mkdir(PROCESSED_DIR, { recursive: true });
    } catch (err) {
        console.error('Error creating directories:', err);
    }
}
initDirs();

// Multer storage configuration to ensure server-assigned filenames
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        // Generate a cryptographically strong random filename to avoid collisions and injection
        const uniqueSuffix = crypto.randomBytes(16).toString('hex');
        const ext = path.extname(file.originalname);
        cb(null, `${uniqueSuffix}${ext}`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // Limit to 5MB
});

/**
 * Resizes an image using the sharp library.
 * Operates on server-assigned paths and validates MIME types.
 */
async function resizeImage(inputPath, filename) {
    const outputFilename = `resized_${filename}`;
    const outputPath = path.join(PROCESSED_DIR, outputFilename);

    await sharp(inputPath)
        .resize(800, 600, { // Example dimensions
            fit: 'inside',
            withoutEnlargement: true 
        })
        .toFile(outputPath);

    return outputPath;
}

app.post('/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // 1. Validate that the input is a supported image format based on MIME type
        if (!SUPPORTED_FORMATS.includes(req.file.mimetype)) {
            // Delete the uploaded file immediately if invalid
            await fs.unlink(req.file.path);
            return res.status(400).json({ error: 'Unsupported image format' });
        }

        // 2. Process the image using the server-assigned path (req.file.path)
        const inputPath = req.file.path;
        const filename = req.file.filename;
        
        const processedPath = await resizeImage(inputPath, filename);

        // 3. Clean up original uploaded file after processing
        await fs.unlink(inputPath);

        res.json({
            message: 'Image resized successfully',
            processedFile: path.basename(processedPath)
        });
    } catch (error) {
        console.error('Processing error:', error);
        
        // Attempt to cleanup file if an error occurred during processing
        if (req.file) {
            try { await fs.unlink(req.file.path); } catch (e) {}
        }

        res.status(500).json({ error: 'Internal server error during image processing' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});