const express = require('express');
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/search', (req, res) => {
    const query = req.query.q;
    // HTML-encode the query to prevent XSS
    const encodedQuery = escapeHtml(query);
    // Set Content-Security-Policy header
    res.setHeader('Content-Security-Policy', "default-src 'self'");
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Search Results</title>
        </head>
        <body>
            <h1>Search Results for "${encodedQuery}"</h1>
            <div id="results"></div>
        </body>
        </html>
    `);
});

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;')
               .replace(/"/g, '&quot;')
               .replace(/'/g, '&#039;');
}

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});