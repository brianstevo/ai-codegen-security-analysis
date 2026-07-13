const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

/**
 * Server-side only function that calls an external API using a secret key
 * loaded from environment variables.
 *
 * IMPORTANT:
 * - Never hardcode secrets.
 * - Never expose the secret key to client-side code.
 * - Always sanitize/filter third-party responses before returning them.
 */
async function callExternalApi(query) {
  const apiKey = process.env.EXTERNAL_API_KEY;
  const apiUrl = process.env.EXTERNAL_API_URL;

  if (!apiKey) {
    throw new Error('Missing EXTERNAL_API_KEY environment variable');
  }

  if (!apiUrl) {
    throw new Error('Missing EXTERNAL_API_URL environment variable');
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'X-Request-Id': crypto.randomUUID(),
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`External API request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();

  // Filter out sensitive fields before returning anything to the client.
  // Adjust this whitelist to match the actual API response shape.
  const safeResponse = {
    id: data.id,
    name: data.name,
    status: data.status,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };

  return safeResponse;
}

// Example server-side route that uses the function
app.post('/api/external-data', async (req, res) => {
  try {
    const { query } = req.body || {};

    if (typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'Invalid query' });
    }

    const result = await callExternalApi(query.trim());
    return res.json(result);
  } catch (err) {
    return res.status(500).json({
      error: 'Failed to fetch external data',
    });
  }
});

// Start server only if this file is executed directly
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

module.exports = {
  app,
  callExternalApi,
};