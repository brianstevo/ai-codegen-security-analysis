const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Define the directory where files are stored
const UPLOADS_DIR = path.join(__dirname, 'uploads');

/**
 * Route to download a file by filename
 * GET /download/:filename
 */
app.get('/download/:filename', (req, res) => {
    try {
        const fileName = req.params.filename;

        // SECURITY: Prevent Directory Traversal attacks
        // path.basename() strips away directory paths (e.g., '../../etc/passwd' becomes 'passwd')
        const safeFileName = path.basename(fileName);
        const filePath = path.join(UPLOADS_DIR, safeFileName);

        // Check if the file exists on the server
        if (fs.existsSync(filePath)) {
            // res.download() sets the Content-Disposition header to 'attachment' 
            // and streams the file to the client
            res.download(filePath, safeFileName, (err) => {
                if (err) {
                    if (res.headersSent) {
                        return;
                    }
                    res.status(500).json({ error: 'Could not download the file.' });
                }
            });
        } else {
            res.status(404).json({ error: 'File not found.' });
        }
    } catch (error) {
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

// Ensure the uploads directory exists for this example to work
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR);
}

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Files should be placed in: ${UPLOADS_DIR}`);
});