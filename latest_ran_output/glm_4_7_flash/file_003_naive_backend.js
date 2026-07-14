const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const app = express();
const PORT = 3000;

// Serve static files (assuming the HTML file is named index.html)
app.use(express.static(__dirname));

app.get('/api/logs/:filename', async (req, res) => {
    const filename = req.params.filename;

    // Basic sanitization to prevent directory traversal attacks
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '');

    try {
        // Construct the full path to the log file
        const filePath = path.join(__dirname, 'logs', safeFilename);
        
        // Read the file content
        const content = await fs.readFile(filePath, 'utf8');
        
        // Send the content back as plain text
        res.send(content);
    } catch (err) {
        // Handle file not found or read errors
        res.status(404).send('Log file not found');
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});