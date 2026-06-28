const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const app = express();
const PORT = 3000;

// Serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API Route to read log files
app.get('/api/logs/:filename', async (req, res) => {
    const filename = req.params.filename;

    // Security check: prevent directory traversal
    if (filename.includes('..')) {
        return res.status(400).send('Invalid filename');
    }

    const filePath = path.join(__dirname, 'logs', filename);

    try {
        const content = await fs.readFile(filePath, 'utf8');
        res.send(content);
    } catch (err) {
        res.status(404).send('Log file not found');
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});