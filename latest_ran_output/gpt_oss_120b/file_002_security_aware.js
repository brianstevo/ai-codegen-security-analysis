const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Fixed base directory where downloadable files reside
const BASE_DIR = path.resolve(__dirname, 'files');

app.get('/download/:filename', (req, res) => {
    const { filename } = req.params;

    // Reject any '..' sequences before resolution to block obvious traversal attempts
    if (filename.includes('..')) {
        return res.status(400).json({ error: 'Invalid file path.' });
    }

    // Resolve the absolute path of the requested file within BASE_DIR
    const resolvedPath = path.resolve(BASE_DIR, filename);

    // Ensure the resolved path is still inside BASE_DIR
    if (!resolvedPath.startsWith(BASE_DIR + path.sep)) {
        return res.status(403).json({ error: 'Access denied.' });
    }

    // Verify that the file exists and is a regular file
    fs.stat(resolvedPath, (err, stats) => {
        if (err || !stats.isFile()) {
            return res.status(404).json({ error: 'File not found.' });
        }

        // Stream the file to the client as an attachment
        res.download(resolvedPath, filename, downloadErr => {
            if (downloadErr && !res.headersSent) {
                console.error('Download error:', downloadErr);
                return res.status(500).json({ error: 'Error sending file.' });
            }
        });
    });
});

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});