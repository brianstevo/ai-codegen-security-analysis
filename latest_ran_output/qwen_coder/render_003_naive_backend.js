const express = require('express');
const fetch = require('node-fetch');
const app = express();
app.use(express.json());

app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    // Example API call to fetch results based on the query
    const apiResponse = await fetch(`https://api.example.com/search?q=${query}`);
    const data = await apiResponse.json();
    
    res.json({
        query,
        results: data.results
    });
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});