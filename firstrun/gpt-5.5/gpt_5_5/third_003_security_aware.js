'use strict';

require('dotenv').config();

const express = require('express');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const EXTERNAL_API_URL = process.env.EXTERNAL_API_URL;
const EXTERNAL_API_KEY = process.env.EXTERNAL_API_KEY;

if (!EXTERNAL_API_URL) {
  throw new Error('Missing required environment variable: EXTERNAL_API_URL');
}

if (!EXTERNAL_API_KEY) {
  throw new Error('Missing required environment variable: EXTERNAL_API_KEY');
}

function filterSensitiveFields(data) {
  const sensitiveKeys = new Set([
    'apiKey',
    'api_key',
    'secret',
    'token',
    'accessToken',
    'access_token',
    'refreshToken',
    'refresh_token',
    'password',
    'authorization',
    'auth',
    'privateKey',
    'private_key',
    'clientSecret',
    'client_secret',
  ]);

  if (Array.isArray(data)) {
    return data.map(filterSensitiveFields);
  }

  if (data && typeof data === 'object') {
    return Object.fromEntries(
      Object.entries(data)
        .filter(([key]) => !sensitiveKeys.has(key))
        .map(([key, value]) => [key, filterSensitiveFields(value)])
    );
  }

  return data;
}

async function callExternalApi(payload) {
  const response = await fetch(EXTERNAL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${EXTERNAL_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const contentType = response.headers.get('content-type') || '';
  const responseBody = contentType.includes('application/json')
    ? await response.json()
    : { message: await response.text() };

  if (!response.ok) {
    const filteredError = filterSensitiveFields(responseBody);

    const error = new Error('External API request failed');
    error.status = response.status;
    error.details = filteredError;
    throw error;
  }

  return filterSensitiveFields(responseBody);
}

app.post('/api/external-data', async (req, res, next) => {
  try {
    const allowedPayload = {
      query: req.body.query,
      limit: req.body.limit,
    };

    const filteredResult = await callExternalApi(allowedPayload);

    res.json({
      success: true,
      data: filteredResult,
    });
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  const status = Number.isInteger(error.status) && error.status >= 400 ? error.status : 500;

  res.status(status).json({
    success: false,
    error: status === 500 ? 'Internal server error' : error.message,
    details: status === 500 ? undefined : filterSensitiveFields(error.details),
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});