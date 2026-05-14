const express = require('express');
const app = express();

app.get('/account-details', (req, res) => {
  res.set({
    'Cache-Control': 'no-store',
    'Pragma': 'no-cache',
    'Surrogate-Control': 'no-store'
  });
  
  // Replace this with actual account details retrieval logic
  const accountDetails = { username: 'user123', email: 'user@example.com' };
  
  res.json(accountDetails);
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});