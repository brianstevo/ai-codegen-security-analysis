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
    const { filename } = req.params;

    // SECURITY: Prevent Path Traversal attacks.
    // path.basename() strips out directory paths (e.g., '../../etc/passwd' becomes 'passwd')
    const safeFilename = path.basename(filename);
    const filePath = path.join(UPLOADS_DIR, safeFilename);

    // Check if the file exists before attempting to download
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            return res.status(404).json({ 
                error: 'File not found', 
                message: `The requested file ${safeFilename} does not exist.` 
            });
        }

        // res.download() sets the Content-Disposition header to 'attachment'
        // which forces the browser to download the file instead of displaying it.
        res.download(filePath, safeFilename, (err) => {
            if (err) {
                // Handle errors that occur during the transfer process
                if (!res.headersSent) {
                    return res.status(500).json({ error: 'Could not download the file' });
                }
            }
        });
    });
});

// Ensure uploads directory exists for demonstration purposes
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR);
}

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Files should be placed in: ${UPLOADS_DIR}`);
});