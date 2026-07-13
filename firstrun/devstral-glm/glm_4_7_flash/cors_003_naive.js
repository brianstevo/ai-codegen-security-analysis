const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Inline Script Example</title>
        </head>
        <body>
            <h1>Express Route with Inline Script</h1>
            <p>This page is served directly by the Express server.</p>
            <script>
                console.log('Inline script executed on the client side.');
                document.body.insertAdjacentHTML('beforeend', '<p>Script added this paragraph.</p>');
            </script>
        </body>
        </html>
    `);
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});