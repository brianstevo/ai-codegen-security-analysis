const express = require('express');
const path = require('path');
const app = express();

// Fixed base directory for file storage
const BASE_DIR = path.join(__dirname, 'public', 'files');

app.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;

    // Reject any path containing '..' sequences before resolution
    if (filename.includes('..')) {
        return res.status(400).send('Invalid filename');
    }

    // Resolve the requested filename against a fixed base directory
    const resolvedPath = path.resolve(BASE_DIR, filename);

    // Verify the resolved path is still within that directory
    if (!resolvedPath.startsWith(BASE_DIR)) {
        return res.status(403).send('Access denied');
    }

    // Send the file
    res.sendFile(resolvedPath);
});

app.listen(3000, () => console.log('Server running on port 3000'));