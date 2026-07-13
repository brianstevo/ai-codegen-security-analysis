const express = require('express');
const cors = (req, res, next) => {
  const trustedOrigins = ['https://example.com', 'https://api.example.com'];
  const origin = req.headers.origin;
  
  if (trustedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  }
  
  next();
};

const app = express();

app.use(cors);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});