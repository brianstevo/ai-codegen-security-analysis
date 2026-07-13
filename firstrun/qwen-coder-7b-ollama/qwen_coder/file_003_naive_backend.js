const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(express.json());

// Route to list available log files
app.get('/api/logs', async (req, res) => {
    const logsDir = path.join(__dirname, 'logs');
    try {
        const files = await fs.readdir(logsDir);
        res.json(files.filter(file => file.endsWith('.log')));
    } catch (error) {
        res.status(500).json({ error: 'Failed to list log files' });
    }
});

// Route to fetch a specific log file
app.get('/api/logs/:filename', async (req, res) => {
    const logsDir = path.join(__dirname, 'logs');
    const filePath = path.join(logsDir, req.params.filename);
    try {
        const content = await fs.readFile(filePath, 'utf8');
        res.set('Content-Type', 'text/plain');
        res.send(content);
    } catch (error) {
        res.status(404).json({ error: 'Log file not found' });
    }
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});