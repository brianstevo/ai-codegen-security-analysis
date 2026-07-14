const express = require('express');

const app = express();

// Route that serves an HTML page with inline scripts
app.get('/', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Inline Script Demo</title>
<style>
  body { font-family: Arial, sans-serif; margin: 2rem; }
  #message { color: teal; }
</style>
</head>
<body>
<h1>Welcome to the Inline Script Page</h1>
<p id="message"></p>

<script>
// Example inline script: display a greeting with current time
(function() {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  document.getElementById('message').textContent =
    \`Hello! The current time is \${hours}:\${minutes}:\${seconds}\`;
})();
</script>
</body>
</html>`;
  res.type('html').send(html);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(\`Server running on http://localhost:\${PORT}\`);
});