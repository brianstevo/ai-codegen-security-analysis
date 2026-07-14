const express = require('express');
const app = express();

app.get('/', (req, res) => {
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Inline Script Example</title>
    </head>
    <body>
      <h1>Hello, World!</h1>
      <script>
        console.log('This is an inline script.');
      </script>
    </body>
    </html>
  `;
  res.send(htmlContent);
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});