const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/logs', (req, res) => {
    const { path } = req.body;

    if (!path) {
        return res.status(400).send('Log file path is required');
    }

    fs.readFile(path, 'utf8', (err, data) => {
        if (err) {
            console.error(`Error reading log file: ${err}`);
            return res.status(500).send(`Error reading log file: ${err.message}`);
        }
        res.send(data);
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});