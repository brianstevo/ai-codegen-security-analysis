const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const app = express();
const port = 3000;

// Set up storage for uploaded files
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        crypto.randomBytes(16, (err, buffer) => {
            if (err) return cb(err);
            const randomName = buffer.toString('hex');
            cb(null, `${randomName}${path.extname(file.originalname)}`);
        });
    }
});

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        const allowedTypes = ['text/plain', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error('Invalid file type. Only .txt, .pdf, and .docx files are allowed.'));
        }
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            return cb(new Error('File size exceeds the limit of 5MB.'));
        }
        const executableExtensions = ['.exe', '.bat', '.sh'];
        if (executableExtensions.includes(path.extname(file.originalname).toLowerCase())) {
            return cb(new Error('Executable files are not allowed.'));
        }
        cb(null, true);
    }
});

// Create uploads directory if it doesn't exist
const fs = require('fs');
const dir = './uploads';
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
}

app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }
    res.json({ message: 'File uploaded successfully.', filename: req.file.filename });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});