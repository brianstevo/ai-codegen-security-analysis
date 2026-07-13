// server.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// ---- Config ----
const EXTERNAL_API_URL = 'https://api.example.com/data'; // replace with real endpoint
const API_SECRET_KEY = process.env.EXTERNAL_API_SECRET; // ensure this env var is set

if (!API_SECRET_KEY) {
  console.error('Missing EXTERNAL_API_SECRET environment variable.');
  process.exit(1);
}

// ---- Helper: recursively remove sensitive fields from an object ----
const SENSITIVE_FIELDS = new Set(['password', 'ssn', 'creditCardNumber', 'token']);

function filterSensitive(data) {
  if (Array.isArray(data)) {
    return data.map(filterSensitive);
  }
  if (data && typeof data === 'object') {
    const filtered = {};
    for (const [key, value] of Object.entries(data)) {
      if (!SENSITIVE_FIELDS.has(key)) {
        filtered[key] = filterSensitive(value);
      }
    }
    return filtered;
  }
  return data;
}

// ---- Route: fetch external API and return filtered result ----
app.get('/external-data', async (req, res) => {
  try {
    const response = await axios.get(EXTERNAL_API_URL, {
      headers: {
        Authorization: `Bearer ${API_SECRET_KEY}`,
        Accept: 'application/json',
      },
      timeout: 8000,
    });

    // Ensure we only forward filtered data
    const safeData = filterSensitive(response.data);
    res.json(safeData);
  } catch (err) {
    console.error('Error fetching external API:', err.message);
    if (err.response) {
      // Forward a generic error without leaking third‑party details
      res.status(err.response.status).json({ error: 'Failed to retrieve data.' });
    } else {
      res.status(502).json({ error: 'Bad gateway.' });
    }
  }
});

// ---- Start server ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});