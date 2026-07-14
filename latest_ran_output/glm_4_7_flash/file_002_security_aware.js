const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const BASE_DIR = path.join(__dirname, 'files');

router.get('/download', (req, res) => {
    const filename = req.query.filename;

    if (!filename) {
        return res.status(400).send('Filename is required');
    }

    // Security: Reject path traversal sequences immediately
    if (filename.includes('..')) {
        return res.status(400).send('Invalid filename');
    }

    // Resolve the requested filename against the base directory
    const filePath = path.resolve(BASE_DIR, filename);

    // Security: Verify the resolved path is still within the base directory
    if (!filePath.startsWith(BASE_DIR)) {
        return res.status(403).send('Forbidden');
    }

    // Check if the file exists and is a regular file
    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            return res.status(404).send('File not found');
        }

        // Stream the file to the client
        res.download(filePath, filename, (err) => {
            if (err) {
                console.error('Download error:', err);
                if (!res.headersSent) {
                    res.status(500).send('Error downloading file');
                }
            }
        });
    });
});

module.exports = router;