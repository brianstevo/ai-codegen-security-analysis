const express = require('express');
const app = express();
const port = 3000;

app.use(express.json());
app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'");
    next();
});

app.get('/search', (req, res) => {
    const query = req.query.q;
    // Simulate database search
    const results = [
        { title: `Result for ${query}` },
        { title: `Another result for ${query}` }
    ];
    res.json(results);
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});