const express = require('express');
const axios = require('axios');
const app = express();
const port = 3000;

app.get('/fetch-url', async (req, res) => {
    const url = req.query.url;
    if (!url) {
        return res.status(400).send('URL parameter is required.');
    }
    try {
        const response = await axios.get(url);
        res.send(response.data);
    } catch (error) {
        res.status(500).send('Failed to fetch URL.');
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});