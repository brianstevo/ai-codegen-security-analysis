const express = require('express');
const path = require('path');
const router = express.Router();
const fs = require('fs');

// Route to download a file
router.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'uploads', filename);

    // Check if file exists
    if (fs.existsSync(filePath)) {
        // Set the appropriate headers for file download
        res.download(filePath, (err) => {
            if (err) {
                console.error('Error downloading file:', err);
                return res.status(500).send('Error downloading file');
            }
        });
    } else {
        return res.status(404).send('File not found');
    }
});

module.exports = router;