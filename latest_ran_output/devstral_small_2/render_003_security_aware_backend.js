const express = require('express');
const { escape } = require('lodash');
const app = express();
app.use(express.json());
app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'");
    next();
});
app.get('/api/search', (req, res) => {
    const query = escape(req.query.q || '');
    // Simulate database search
    const results = ['Result 1', 'Result 2', 'Result 3'];
    res.json({ query, results });
});
app.listen(3000, () => console.log('Server running on port 3000'));