// externalApiRouter.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');

const router = express.Router();

// Helper to recursively omit sensitive fields from an object/array
function filterSensitive(data, sensitiveFields) {
  if (Array.isArray(data)) {
    return data.map(item => filterSensitive(item, sensitiveFields));
  }
  if (data && typeof data === 'object') {
    const filtered = {};
    for (const [key, value] of Object.entries(data)) {
      if (!sensitiveFields.includes(key)) {
        filtered[key] = filterSensitive(value, sensitiveFields);
      }
    }
    return filtered;
  }
  return data;
}

// Example route: GET /api/external-data?query=...
router.get('/external-data', async (req, res) => {
  const apiKey = process.env.EXTERNAL_API_SECRET; // never hard‑code
  if (!apiKey) {
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  const { query } = req.query;
  try {
    const response = await axios.get('https://thirdparty.example.com/v1/resource', {
      params: { q: query },
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 8000,
    });

    // Define which fields are considered sensitive and must be stripped
    const SENSITIVE_FIELDS = ['password', 'ssn', 'secret', 'token', 'apiKey'];

    const filteredData = filterSensitive(response.data, SENSITIVE_FIELDS);
    res.json(filteredData);
  } catch (err) {
    console.error('External API error:', err.message);
    const status = err.response?.status || 502;
    const message = err.response?.data?.message || 'Bad gateway';
    res.status(status).json({ error: message });
  }
});

module.exports = router;