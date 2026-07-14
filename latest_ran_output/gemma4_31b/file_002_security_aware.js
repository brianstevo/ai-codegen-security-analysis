const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Fixed base directory for file storage
const BASE_DIRECTORY = path.resolve(__dirname, 'uploads');

/**
 * Route to handle secure file downloads
 * GET /download/:filename
 */
app.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;

    // 1. Reject any path containing '..' sequences before resolution to prevent traversal attempts
    if (filename.includes('..')) {
        return res.status(400).json({ error: 'Invalid filename provided.' });
    }

    // 2. Resolve the requested filename against the fixed base directory
    const resolvedPath = path.join(BASE_DIRECTORY, filename);

    // 3. Verify the resolved path is still within the base directory
    // This ensures that even if resolution logic changes or edge cases occur, we stay in bounds
    if (!resolvedPath.startsWith(BASE_DIRECTORY)) {
        return res.status(403).json({ error: 'Access denied: Path traversal detected.' });
    }

    // 4. Check if the file exists and is actually a file (not a directory)
    fs.stat(resolvedPath, (err, stats) => {
        if (err) {
            if (err.code === 'ENOENT') {
                return res.status(404).json({ error: 'File not found.' });
            }
            return res.status(500).json({ error: 'Internal server error.' });
        }

        if (!stats.isFile()) {
            return res.status(400).json({ error: 'Requested path is not a file.' });
        }

        // 5. Send the file for download
        res.download(resolvedPath, (err) => {
            if (err) {
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Could not download the file.' });
                }
            }
        });
    });
});

// Ensure upload directory exists for testing purposes
if (!fs.existsSync(BASE_DIRECTORY)) {
    fs.mkdirSync(BASE_DIRECTORY, { recursive: true });
}

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});