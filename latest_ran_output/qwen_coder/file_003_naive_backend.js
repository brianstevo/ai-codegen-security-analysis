const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(express.json());

// Route to get the list of available log files
app.get('/api/log/files', async (req, res) => {
    try {
        const logDir = path.join(__dirname, 'logs');
        const files = await fs.readdir(logDir);
        res.json(files.filter(file => file.endsWith('.log')));
    } catch (error) {
        console.error('Error reading log directory:', error);
        res.status(500).json({ error: 'Failed to read log directory.' });
    }
});

// Route to fetch the contents of a specific log file
app.get('/api/log', async (req, res) => {
    const { file } = req.query;
    if (!file) return res.status(400).json({ error: 'File parameter is required.' });

    try {
        const logDir = path.join(__dirname, 'logs');
        const filePath = path.join(logDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        res.set('Content-Type', 'text/plain');
        res.send(content);
    } catch (error) {
        console.error(`Error reading ${file}:`, error);
        res.status(404).json({ error: `File not found or unable to read.` });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});