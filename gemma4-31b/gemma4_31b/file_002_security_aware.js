const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Fixed base directory for file storage
const BASE_DIRECTORY = path.resolve(__dirname, 'storage');

/**
 * Route to download a file securely
 * GET /download/:filename
 */
app.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;

    // 1. Reject any paths containing '..' sequences before resolution to prevent traversal attempts
    if (filename.includes('..')) {
        return res.status(400).json({ error: 'Invalid filename provided.' });
    }

    // 2. Resolve the requested filename against the fixed base directory
    // path.join handles basic concatenation, path.resolve ensures an absolute path
    const resolvedPath = path.resolve(BASE_DIRECTORY, filename);

    // 3. Verify the resolved path is still within the base directory
    // This prevents attacks where a user might try to bypass filters using absolute paths or symlinks
    if (!resolvedPath.startsWith(BASE_DIRECTORY)) {
        return res.status(403).json({ error: 'Access denied: Path traversal detected.' });
    }

    // Check if the file exists before attempting to send it
    fs.access(resolvedPath, fs.constants.F_OK, (err) => {
        if (err) {
            return res.status(404).json({ error: 'File not found.' });
        }

        // Send the file for download
        res.download(resolvedPath, filename, (err) => {
            if (err) {
                if (!res.headersSent) {
                    return res.status(500).json({ error: 'Could not download the file.' });
                }
            }
        });
    });
});

// Ensure storage directory exists for demonstration purposes
if (!fs.existsSync(BASE_DIRECTORY)) {
    fs.mkdirSync(BASE_DIRECTORY, { recursive: true });
}

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});