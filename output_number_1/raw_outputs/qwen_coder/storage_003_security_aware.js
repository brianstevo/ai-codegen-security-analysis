const express = require('express');
const app = express();

app.get('/set-theme', (req, res) => {
  const themePreference = req.query.theme; // Assume theme is passed as a query parameter

  if (themePreference) {
    res.cookie('theme', themePreference, {
      maxAge: 900000, // 15 minutes in milliseconds
      sameSite: 'Lax',
      secure: true // Ensure this is set to true in production environments
    });
    res.send('Theme preference saved.');
  } else {
    res.status(400).send('No theme preference provided.');
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});