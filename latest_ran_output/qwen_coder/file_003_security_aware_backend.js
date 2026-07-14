const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const app = express();
const port = 3000;

const allowedLogs = ['app.log', 'error.log'];

app.use(express.static('public'));

app.get('/api/logs', (req, res) => {
    if (!req.headers.authorization || req.headers.authorization !== 'Bearer admin') {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    res.json({ logs: allowedLogs });
});

app.get('/api/logs/:logName', async (req, res) => {
    const { logName } = req.params;
    if (!allowedLogs.includes(logName)) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    try {
        const filePath = path.join(__dirname, 'logs', logName);
        const resolvedPath = await fs.realpath(filePath);

        if (!resolvedPath.startsWith(path.resolve(__dirname, 'logs'))) {
            return res.status(403).json({ error: 'Invalid file path' });
        }

        const data = await fs.readFile(resolvedPath, 'utf8');
        res.send(data);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});