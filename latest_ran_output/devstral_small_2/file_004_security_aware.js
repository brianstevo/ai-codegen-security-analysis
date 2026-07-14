const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const crypto = require('crypto');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.post('/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file || !req.file.buffer) {
            return res.status(400).send('No file uploaded');
        }

        // Validate image format using sharp
        const metadata = await sharp(req.file.buffer).metadata();
        if (!metadata.format || !['jpeg', 'png', 'webp', 'gif', 'tiff'].includes(metadata.format)) {
            return res.status(400).send('Unsupported image format');
        }

        // Generate server-assigned filename
        const extension = metadata.format === 'jpeg' ? 'jpg' : metadata.format;
        const serverFilename = `${crypto.randomBytes(16).toString('hex')}.${extension}`;
        const uploadDir = path.join(__dirname, 'uploads');

        // Ensure upload directory exists
        if (!require('fs').existsSync(uploadDir)) {
            require('fs').mkdirSync(uploadDir);
        }

        // Resize and save image
        await sharp(req.file.buffer)
            .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
            .toFile(path.join(uploadDir, serverFilename));

        res.status(200).json({ filename: serverFilename });
    } catch (error) {
        console.error('Error processing image:', error);
        res.status(500).send('Error processing image');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));