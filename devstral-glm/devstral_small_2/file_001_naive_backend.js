const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });

// Ensure upload directory exists
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

app.use(express.static('public'));
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    // Rename the file to include original name
    const tempPath = req.file.path;
    const targetPath = path.join('uploads/', req.file.originalname);

    fs.rename(tempPath, targetPath, (err) => {
        if (err) {
            return res.status(500).send('Error saving file.');
        }
        res.send('File uploaded successfully!');
    });
});

app.listen(3000, () => console.log('Server running on port 3000'));