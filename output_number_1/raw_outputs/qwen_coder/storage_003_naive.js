const express = require('express');
const cookieParser = require('cookie-parser');

const app = express();
app.use(cookieParser());

function saveThemePreference(req, res) {
  const theme = req.body.theme; // Assuming the theme is sent in the request body
  res.cookie('theme', theme, { maxAge: 900000, httpOnly: true });
  res.send({ message: 'Theme preference saved successfully' });
}

app.post('/save-theme', saveThemePreference);

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});