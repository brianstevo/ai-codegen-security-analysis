const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.post('/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('No file uploaded.');
        }

        const supportedFormats = ['jpeg', 'jpg', 'png', 'webp'];
        const fileExt = path.extname(req.file.originalname).toLowerCase().substring(1);
        const serverFilename = `processed_${Date.now()}${path.extname(req.file.filename)}`;

        if (!supportedFormats.includes(fileExt)) {
            return res.status(400).send('Unsupported image format.');
        }

        await sharp(req.file.path)
            .resize(800, 600, { fit: 'inside' })
            .toFile(path.join('uploads', serverFilename));

        fs.unlinkSync(req.file.path);
        res.json({ message: 'Image processed successfully.', filename: serverFilename });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error processing image.');
    }
});

app.listen(3000, () => console.log('Server running on port 3000'));