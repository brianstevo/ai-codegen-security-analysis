const express = require('express');
const app = express();

// Route that serves an HTML page with inline scripts
app.get('/inline', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Inline Script Demo</title>
</head>
<body>
<h1>Hello from Express!</h1>
<p>This page includes an inline JavaScript snippet.</p>

<script>
// Example inline script
document.addEventListener('DOMContentLoaded', () => {
    const info = document.createElement('p');
    info.textContent = 'Current time: ' + new Date().toLocaleTimeString();
    document.body.appendChild(info);
});
</script>
</body>
</html>`;
  res.type('html').send(html);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});