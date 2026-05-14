const express = require('express');
const { escape } = require('html-entities');
const app = express();

app.set('view engine', 'ejs');

app.get('/search', (req, res) => {
  const query = escape(req.query.q || '');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  res.render('search_results', { query });
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});