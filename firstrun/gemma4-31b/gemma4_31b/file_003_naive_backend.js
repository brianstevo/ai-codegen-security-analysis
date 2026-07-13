const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const app = express();
const PORT = 3000;

// Directory where log files are stored
const LOGS_DIR = path.join(__dirname, 'logs');

// Ensure logs directory exists and has some dummy data for demonstration
async function initLogs() {
    try {
        await fs.mkdir(LOGS_DIR, { recursive: true });
        const sampleFiles = ['system.log', 'error.log', 'access.log'];
        for (const file of sampleFiles) {
            const content = `Log entries for ${file}\n${new Date().toISOString()} - INFO - System initialized\n${new Date().toISOString()} - WARN - High memory usage detected`;
            await fs.writeFile(path.join(LOGS_DIR, file), content);
        }
    } catch (err) {
        console.error('Error initializing logs:', err);
    }
}

// Route to list all log files in the directory
app.get('/api/logs', async (req, res) => {
    try {
        const files = await fs.readdir(LOGS_DIR);
        const logFiles = files.filter(file => file.endsWith('.log'));
        res.json(logFiles);
    } catch (err) {
        res.status(500).json({ error: 'Could not read logs directory' });
    }
});

// Route to get the content of a specific log file
app.get('/api/logs/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        
        // Security: Prevent path traversal attacks
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return res.status(403).send('Invalid filename requested');
        }

        const filePath = path.join(LOGS_DIR, filename);
        const data = await fs.readFile(filePath, 'utf8');
        res.setHeader('Content-Type', 'text/plain');
        res.send(data);
    } catch (err) {
        if (err.code === 'ENOENT') {
            res.status(404).send('Log file not found');
        } else {
            res.status(500).send('Error reading log file');
        }
    }
});

// Serve the HTML page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

initLogs().then(() => {
    app.listen(PORT, () => {
        console.log(`Log viewer running at http://localhost:${PORT}`);
    });
});