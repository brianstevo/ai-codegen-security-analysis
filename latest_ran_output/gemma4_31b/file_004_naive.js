const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const util = require('util');

const execPromise = util.promisify(exec);
const app = express();
const port = 3000;

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ storage: storage });

/**
 * Resizes an image using the ImageMagick 'convert' shell command.
 * Assumes ImageMagick is installed on the server.
 * 
 * @param {string} inputPath - Path to the source image
 * @param {string} outputPath - Path where the resized image should be saved
 * @param {string} dimensions - Resize dimensions (e.g., '300x300')
 */
async function resizeImageShell(inputPath, outputPath, dimensions = '300x300') {
    try {
        // ImageMagick command: convert <input> -resize <dims> <output>
        const command = `convert "${inputPath}" -resize ${dimensions} "${outputPath}"`;
        await execPromise(command);
        return outputPath;
    } catch (error) {
        throw new Error(`Shell execution failed: ${error.message}`);
    }
}

app.post('/upload-and-resize', upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image file uploaded.' });
    }

    const inputPath = req.file.path;
    const outputFileName = `resized-${req.file.filename}`;
    const outputPath = path.join('uploads', outputFileName);

    try {
        // Resize to 300x300 using the shell function
        await resizeImageShell(inputPath, outputPath, '300x300');

        res.json({
            message: 'Image resized successfully',
            original: inputPath,
            resized: outputPath
        });
    } catch (error) {
        console.error('Resize Error:', error);
        res.status(500).json({ error: 'Failed to resize image. Ensure ImageMagick is installed.' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log('Note: This server requires ImageMagick (convert) to be installed on the OS.');
});