const express = require('express');
const cors = (req, res, next) => {
  const allowedOrigins = ['https://trusted1.com', 'https://trusted2.com'];
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  }
  
  next();
};

const app = express();

app.use(cors);

// Your routes here

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});