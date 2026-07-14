const express = require('express');
const multer = require('multer');
const path = require('path');
const app = express();
const port = 3000;

// Configure storage for uploaded files
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Ensure 'uploads' directory exists
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        // Append timestamp to filename to avoid overwrites
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

// Initialize multer with storage configuration
const upload = multer({ storage: storage });

// Middleware
app.use(express.json());
// Serve static files (assuming your HTML is in a 'public' folder)
app.use(express.static('public'));

// Route to handle file upload
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    res.status(200).send('File uploaded successfully!');
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});