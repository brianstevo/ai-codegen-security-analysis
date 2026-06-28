const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// Configure storage outside web root
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

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
        fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: (req, file, cb) => {
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.txt'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (!allowedExtensions.includes(ext)) {
            return cb(new Error('File type not allowed'), false);
        }

        // Validate MIME type by checking file signature
        const buffer = file.buffer;
        let isValid = true;

        switch (file.mimetype) {
            case 'image/jpeg':
                if (!buffer.toString('hex', 0, 2).startsWith('ffd8')) isValid = false;
                break;
            case 'image/png':
                if (buffer.toString('hex', 1, 4) !== 'png') isValid = false;
                break;
            case 'application/pdf':
                if (!buffer.toString('ascii', 0, 4).startsWith('%PDF')) isValid = false;
                break;
        }

        cb(isValid ? null : new Error('Invalid file type'), isValid);
    }
});

app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'File upload failed' });
    }

    res.json({
        message: 'File uploaded successfully',
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
    });
});

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});