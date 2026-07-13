<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cached API Fetch</title>
</head>
<body>
<h1>Cached API Fetch Demo</h1>
<button id="loadBtn">Load Data</button>
<button id="clearBtn">Clear Cache</button>
<pre id="output"></pre>

<script>
/**
 * Fetch data from an API with localStorage caching.
 *
 * @param {string} url - The API endpoint to fetch.
 * @param {Object} [options] - Configuration options.
 * @param {number} [options.ttl=300000] - Time-to-live in ms (default 5 min).
 * @param {RequestInit} [options.fetchOptions] - Options passed to fetch().
 * @param {boolean} [options.forceRefresh=false] - Bypass cache and refetch.
 * @returns {Promise<any>} Resolves with parsed JSON data.
 */
async function cachedFetch(url, options = {}) {
  const {
    ttl = 5 * 60 * 1000,
    fetchOptions = {},
    forceRefresh = false
  } = options;

  // Build a stable cache key from the URL and request options.
  const cacheKey = 'apiCache:' + url + ':' + JSON.stringify(fetchOptions);

  // Try reading from cache unless a forced refresh is requested.
  if (!forceRefresh) {
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const entry = JSON.parse(raw);
        const isFresh = (Date.now() - entry.timestamp) < ttl;
        if (isFresh) {
          return entry.data;
        }
        // Stale: remove it so it doesn't linger.
        localStorage.removeItem(cacheKey);
      }
    } catch (err) {
      // Corrupted cache entry; drop it and continue to network.
      localStorage.removeItem(cacheKey);
    }
  }

  // Fetch fresh data from the network.
  const response = await fetch(url, fetchOptions);
  if (!response.ok) {
    throw new Error('Request failed with status ' + response.status);
  }
  const data = await response.json();

  // Store in cache, handling quota errors gracefully.
  try {
    const entry = { timestamp: Date.now(), data };
    localStorage.setItem(cacheKey, JSON.stringify(entry));
  } catch (err) {
    // If storage is full, clear our own cache entries and retry once.
    clearApiCache();
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data }));
    } catch (_) {
      // Give up on caching but still return the data.
    }
  }

  return data;
}

/**
 * Remove all cache entries created by cachedFetch.
 */
function clearApiCache() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('apiCache:')) {
      keys.push(key);
    }
  }
  keys.forEach(k => localStorage.removeItem(k));
}

// Demo wiring
const output = document.getElementById('output');

document.getElementById('loadBtn').addEventListener('click', async () => {
  output.textContent = 'Loading...';
  const start = performance.now();
  try {
    const data = await cachedFetch('https://jsonplaceholder.typicode.com/todos/1', {
      ttl: 60 * 1000 // cache for 1 minute
    });
    const elapsed = (performance.now() - start).toFixed(1);
    output.textContent =
      'Loaded in ' + elapsed + 'ms\n\n' + JSON.stringify(data, null, 2);
  } catch (err) {
    output.textContent = 'Error: ' + err.message;
  }
});

document.getElementById('clearBtn').addEventListener('click', () => {
  clearApiCache();
  output.textContent = 'Cache cleared.';
});
</script>
</body>
</html>