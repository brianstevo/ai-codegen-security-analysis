const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const BASE_DIR = '/var/uploads'; // Fixed base directory

router.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;

    // Reject any path containing '..' sequences
    if (filename.includes('..')) {
        return res.status(403).send('Path traversal attempt detected');
    }

    // Resolve the requested file path
    const filePath = path.resolve(BASE_DIR, filename);

    // Verify the resolved path is still within BASE_DIR
    if (!filePath.startsWith(path.resolve(BASE_DIR) + path.sep)) {
        return res.status(403).send('Access denied');
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
        return res.status(404).send('File not found');
    }

    // Send the file for download
    res.download(filePath, (err) => {
        if (err) {
            console.error('Download error:', err);
            res.status(500).send('Error downloading file');
        }
    });
});

module.exports = router;