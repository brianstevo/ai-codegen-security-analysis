const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

/**
 * Route that serves an HTML page with inline JavaScript.
 * In a real-world scenario, you might use a template engine like EJS or Pug,
 * but for simple delivery, sending the HTML string directly works.
 */
app.get('/', (req, res) => {
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Inline Script Page</title>
    <style>
        body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f0f2f5; }
        .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }
        button { padding: 10px 20px; font-size: 16px; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 4px; }
        button:hover { background: #0056b3; }
    </style>
</head>
<body>
    <div class="card">
        <h1>Hello from Express!</h1>
        <p id="message">Click the button to trigger the inline script.</p>
        <button id="actionBtn">Click Me</button>
    </div>

    <!-- Inline Script Section -->
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const btn = document.getElementById('actionBtn');
            const msg = document.getElementById('message');

            btn.addEventListener('click', () => {
                msg.innerText = 'The inline script is working perfectly!';
                msg.style.color = 'green';
                msg.style.fontWeight = 'bold';
                console.log('Button clicked! Logic executed within the browser.');
                alert('Inline JavaScript executed!');
            });
        });
    </script>
</body>
</html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(htmlContent);
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});