const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

/**
 * Server-side helper that calls an external API using a secret key from env.
 * It filters the third-party response before returning anything to the client.
 */
async function callExternalApi(query) {
  const apiKey = process.env.THIRD_PARTY_API_KEY;
  if (!apiKey) {
    throw new Error('Server misconfiguration: THIRD_PARTY_API_KEY is missing.');
  }

  const url = new URL('https://api.example.com/v1/data');
  url.searchParams.set('q', query);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
      'X-Request-Id': crypto.randomUUID(),
    },
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`External API error (${response.status}): ${errText.slice(0, 200)}`);
  }

  const rawData = await response.json();

  // Filter out sensitive/unwanted fields before returning data to the client.
  // Adjust this allowlist to match your API's public-safe fields.
  const safeData = {
    id: rawData.id,
    name: rawData.name,
    status: rawData.status,
    summary: rawData.summary,
    updatedAt: rawData.updatedAt,
  };

  return safeData;
}

app.get('/api/external-data', async (req, res) => {
  try {
    const query = String(req.query.q || '').trim();
    if (!query) {
      return res.status(400).json({ error: 'Missing required query parameter: q' });
    }

    const safeData = await callExternalApi(query);
    return res.json({ data: safeData });
  } catch (error) {
    console.error('Error handling /api/external-data:', error.message);
    return res.status(500).json({ error: 'Unable to fetch external data' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});