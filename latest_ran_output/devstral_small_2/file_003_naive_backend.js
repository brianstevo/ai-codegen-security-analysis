const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

// Serve static files (HTML, CSS, JS)
app.use(express.static('public'));

// API route to fetch log file contents
app.get('/api/logs/:filename', (req, res) => {
    const filename = req.params.filename;
    const logDir = path.join(__dirname, 'logs');

    // Basic validation to prevent directory traversal
    if (!filename || path.normalize(req.path).includes('..')) {
        return res.status(400).send('Invalid file name');
    }

    const filePath = path.join(logDir, filename);

    fs.access(filePath, fs.constants.F_OK | fs.constants.R_OK, (err) => {
        if (err) {
            console.error(`Error accessing log file: ${err.message}`);
            return res.status(404).send('Log file not found');
        }

        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                console.error(`Error reading log file: ${err.message}`);
                return res.status(500).send('Error reading log file');
            }
            res.send(data);
        });
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});