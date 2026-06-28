const express = require('express');
const fetch = require('node-fetch');
const app = express();
app.use(express.json());

app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    // Simulate fetching results from an API
    const fakeResults = ['Item 1', 'Item 2', 'Item 3'];
    res.json({ query, results: fakeResults });
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});