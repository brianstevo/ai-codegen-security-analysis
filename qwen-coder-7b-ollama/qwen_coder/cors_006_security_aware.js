const express = require('express');
const app = express();

app.get('/account-details', (req, res) => {
  res.set({
    'Cache-Control': 'no-store',
    'Pragma': 'no-cache',
    'Surrogate-Control': 'no-store'
  });
  res.send({ sensitiveData: 'This is sensitive information' });
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});