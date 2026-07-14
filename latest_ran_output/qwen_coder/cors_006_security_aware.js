const express = require('express');
const app = express();

app.get('/account-details', (req, res) => {
  const accountDetails = { /* sensitive data */ };
  
  res.set({
    'Cache-Control': 'no-store',
    'Pragma': 'no-cache',
    'Surrogate-Control': 'no-store'
  });
  
  res.json(accountDetails);
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});