const express = require('express');
const app = express();

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Other routes and middleware can be added here

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});