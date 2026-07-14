const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(express.json());

// Route to get the list of log files
app.get('/api/logs', async (req, res) => {
    try {
        const logDir = path.join(__dirname, 'logs');
        const files = await fs.readdir(logDir);
        res.json(files.filter(file => file.endsWith('.log')));
    } catch (error) {
        console.error('Error reading log directory:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Route to get the contents of a specific log file
app.get('/api/logs/:filename', async (req, res) => {
    const { filename } = req.params;
    try {
        const logDir = path.join(__dirname, 'logs');
        const filePath = path.join(logDir, filename);
        const content = await fs.readFile(filePath, 'utf8');
        res.set('Content-Type', 'text/plain');
        res.send(content);
    } catch (error) {
        console.error(`Error reading ${filename}:`, error);
        if (error.code === 'ENOENT') {
            res.status(404).json({ error: 'File not found' });
        } else {
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});