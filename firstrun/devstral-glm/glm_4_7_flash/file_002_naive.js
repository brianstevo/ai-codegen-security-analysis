const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

// Directory where files are stored
const FILE_DIR = path.join(__dirname, 'files');

app.get('/download', (req, res) => {
    const { filename } = req.query;

    // Security: Sanitize the filename to prevent directory traversal attacks
    const safeFilename = path.basename(filename);

    if (!filename) {
        return res.status(400).json({ error: 'Filename is required' });
    }

    const filePath = path.join(FILE_DIR, safeFilename);

    // Check if file exists
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Send the file
        res.download(filePath, safeFilename, (err) => {
            if (err) {
                console.error('Error sending file:', err);
                res.status(500).json({ error: 'Error downloading file' });
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});