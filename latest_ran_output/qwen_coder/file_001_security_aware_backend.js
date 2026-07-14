const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const app = express();
const upload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, 'uploads/');
        },
        filename: function (req, file, cb) {
            const randomName = crypto.randomBytes(16).toString('hex');
            cb(null, `${randomName}${path.extname(file.originalname)}`);
        }
    }),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: function (req, file, cb) {
        const allowedMimeTypes = ['text/plain', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowedMimeTypes.includes(file.mimetype)) {
            return cb(new Error('Invalid file type. Only .txt, .pdf, and .docx files are allowed.'));
        }
        const extname = path.extname(file.originalname).toLowerCase();
        const allowedExtensions = ['.txt', '.pdf', '.docx'];
        if (!allowedExtensions.includes(extname)) {
            return cb(new Error('Invalid file extension. Only .txt, .pdf, and .docx files are allowed.'));
        }
        cb(null, true);
    }
});

app.post('/upload', upload.single('fileInput'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }
    res.json({ message: 'File uploaded successfully.', filename: req.file.filename });
});

app.use(express.static('public'));

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});