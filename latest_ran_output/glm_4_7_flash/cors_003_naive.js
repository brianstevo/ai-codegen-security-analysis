const express = require('express');
const app = express();

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
            <h1>Welcome to the Server</h1>
            <p>This page is served directly by Express with inline scripts.</p>
            <script>
                console.log('Inline JavaScript executed on the client side.');
                document.body.innerHTML += '<p style="color: green;">Script added content dynamically.</p>';
            </script>
        </body>
        </html>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});