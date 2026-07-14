const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const app = express();

// Serve static files (like the HTML page)
app.use(express.static(path.join(__dirname, 'public')));

// Route to list available log files
app.get('/api/logs/list', async (req, res) => {
    try {
        const logsDir = path.join(__dirname, 'logs');
        
        // Ensure logs directory exists
        await fs.mkdir(logsDir, { recursive: true });
        
        const files = await fs.readdir(logsDir);
        const logFiles = files.filter(file => 
            file.endsWith('.log') || file.endsWith('.txt')
        );
        
        res.json(logFiles.sort());
    } catch (error) {
        console.error('Error reading logs directory:', error);
        res.status(500).json({ error: 'Failed to read logs directory' });
    }
});

// Route to fetch specific log file content
app.get('/api/logs/file', async (req, res) => {
    try {
        const { name } = req.query;
        
        if (!name) {
            return res.status(400).json({ error: 'Log file name is required' });
        }
        
        // Prevent directory traversal attacks
        const safeName = path.basename(name);
        const filePath = path.join(__dirname, 'logs', safeName);
        
        // Verify the resolved path is within the logs directory
        const resolvedPath = path.resolve(filePath);
        if (!resolvedPath.startsWith(path.resolve(__dirname, 'logs'))) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const content = await fs.readFile(filePath, 'utf8');
        res.type('text/plain').send(content);
    } catch (error) {
        console.error('Error reading log file:', error);
        if (error.code === 'ENOENT') {
            res.status(404).json({ error: 'Log file not found' });
        } else {
            res.status(500).json({ error: 'Failed to read log file' });
        }
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Log viewer running on http://localhost:${PORT}`);
});