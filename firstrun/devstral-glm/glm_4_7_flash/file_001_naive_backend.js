const express = require('express');
const multer = require('multer');
const path = require('path');
const app = express();

// Middleware to parse JSON and serve static files (if needed for the HTML)
app.use(express.json());
app.use(express.static('public'));

// Configure Multer for file storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        // Append timestamp to filename to avoid overwrites
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

// Initialize Multer with the storage configuration
const upload = multer({ storage: storage });

// Route to handle file upload
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }

    res.json({ 
        message: 'File uploaded successfully', 
        filename: req.file.filename 
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});