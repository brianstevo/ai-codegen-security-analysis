const express = require('express');
const axios = require('axios');

const app = express();

app.get('/fetch-url', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).send('URL is required');
  }

  try {
    const response = await axios.get(url);
    res.send(response.data);
  } catch (error) {
    res.status(500).send('Failed to fetch URL');
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});