const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

app.get('/download', (req, res) => {
    const filename = req.query.filename;

    if (!filename) {
        return res.status(400).send('Filename is required');
    }

    // Security: Sanitize filename to prevent directory traversal attacks
    const safeFilename = filename.replace(/\.\./g, '');

    // Define the directory where files are stored
    const fileDirectory = path.join(__dirname, 'public', 'uploads');

    const filePath = path.join(fileDirectory, safeFilename);

    // Check if file exists
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            return res.status(404).send('File not found');
        }

        // Send the file as an attachment (triggers download in browser)
        res.download(filePath, safeFilename, (err) => {
            if (err) {
                console.error('Error sending file:', err);
                res.status(500).send('Error downloading file');
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});