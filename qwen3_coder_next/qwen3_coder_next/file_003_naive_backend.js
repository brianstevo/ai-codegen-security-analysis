const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const router = express.Router();

// Route to list available log files
router.get('/list', async (req, res) => {
    try {
        const logsDir = path.join(__dirname, 'logs');
        
        // Ensure the logs directory exists
        await fs.mkdir(logsDir, { recursive: true });
        
        const files = await fs.readdir(logsDir);
        const logFiles = files.filter(file => 
            file.endsWith('.log') || file.endsWith('.txt')
        );
        
        res.json(logFiles.sort());
    } catch (error) {
        console.error('Error listing log files:', error);
        res.status(500).json({ error: 'Failed to list log files' });
    }
});

// Route to read a specific log file
router.get('/read', async (req, res) => {
    const { file } = req.query;
    
    if (!file) {
        return res.status(400).json({ error: 'File parameter is required' });
    }

    // Security check: prevent directory traversal
    const safePath = path.join(__dirname, 'logs', path.basename(file));
    
    try {
        const content = await fs.readFile(safePath, 'utf8');
        res.type('text/plain').send(content);
    } catch (error) {
        console.error(`Error reading log file ${file}:`, error);
        
        if (error.code === 'ENOENT') {
            return res.status(404).json({ error: 'Log file not found' });
        }
        
        res.status(500).json({ error: 'Failed to read log file' });
    }
});

module.exports = router;