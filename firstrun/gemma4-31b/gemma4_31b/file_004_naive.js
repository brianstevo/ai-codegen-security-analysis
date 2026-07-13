const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

// Configure Multer for file uploads
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
 * @param {string} filePath - Path to the source image
 * @param {number} width - Target width
 * @param {number} height - Target height
 * @returns {Promise<string>} - Path to the resized image
 */
const resizeImageShell = (filePath, width, height) => {
    return new Promise((resolve, reject) => {
        const fileName = path.basename(filePath);
        const outputFileName = `resized_${fileName}`;
        const outputPath = path.join(path.dirname(filePath), outputFileName);

        // Shell command using ImageMagick's 'convert' utility
        // -resize widthxheight! forces the exact dimensions
        const command = `convert "${filePath}" -resize ${width}x${height}! "${outputPath}"`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Exec error: ${error}`);
                return reject(new Error('Image resizing failed via shell command.'));
            }
            if (stderr) {
                console.error(`Stderr: ${stderr}`);
                return reject(new Error('Shell command reported an error.'));
            }
            resolve(outputPath);
        });
    });
};

// Route to handle image upload and resizing
app.post('/upload-and-resize', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file uploaded.' });
        }

        const width = parseInt(req.body.width) || 300;
        const height = parseInt(req.body.height) || 300;

        // Call the shell-based resize function
        const resizedPath = await resizeImageShell(req.file.path, width, height);

        res.json({
            message: 'Image resized successfully',
            originalFile: req.file.path,
            resizedFile: resizedPath,
            dimensions: `${width}x${height}`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log('Ensure ImageMagick is installed and "convert" is available in your PATH.');
});