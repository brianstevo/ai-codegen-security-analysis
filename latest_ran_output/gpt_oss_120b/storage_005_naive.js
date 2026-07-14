/**
 * Fetches a resource with caching support using localStorage.
 *
 * @param {string} url - The request URL.
 * @param {Object} [options={}] - fetch options (method, headers, body, etc.).
 * @param {Object} [config={}] - Cache configuration:
 *   @property {number} ttl - Time‑to‑live in ms (default 5 min).
 *   @property {string} key - Optional custom cache key; defaults to URL + serialized options.
 *   @property {boolean} forceRefresh - If true, bypasses the cache and updates it.
 *
 * @returns {Promise<any>} Resolves with the parsed JSON response (or raw text if not JSON).
 */
function fetchWithCache(url, options = {}, config = {}) {
  const {
    ttl = 5 * 60 * 1000, // default: 5 minutes
    key = null,
    forceRefresh = false,
  } = config;

  const cacheKey = key || `${url}|${JSON.stringify(options)}`;

  // Helper to read from localStorage and validate TTL
  function getCached() {
    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) return null;
      const { timestamp, payload, isJson } = JSON.parse(raw);
      if (Date.now() - timestamp > ttl) {
        // stale entry – remove it
        localStorage.removeItem(cacheKey);
        return null;
      }
      return isJson ? JSON.parse(payload) : payload;
    } catch (_) {
      // Corrupted entry – clean up
      localStorage.removeItem(cacheKey);
      return null;
    }
  }

  // Helper to write into localStorage
  function setCache(data, isJson) {
    const entry = {
      timestamp: Date.now(),
      payload: isJson ? JSON.stringify(data) : data,
      isJson,
    };
    try {
      localStorage.setItem(cacheKey, JSON.stringify(entry));
    } catch (_) {
      // Storage quota exceeded – optionally implement LRU eviction here
    }
  }

  // Return cached value if present and not forced to refresh
  const cached = !forceRefresh && getCached();
  if (cached !== null) return Promise.resolve(cached);

  // Perform network request
  return fetch(url, options)
    .then(response => {
      // Clone response so we can read it twice if needed
      const clone = response.clone();

      // Try JSON first; fall back to text on failure
      return clone.json()
        .then(data => ({ data, isJson: true }))
        .catch(() =>
          clone.text().then(txt => ({ data: txt, isJson: false }))
        );
    })
    .then(({ data, isJson }) => {
      setCache(data, isJson);
      return data;
    });
}

/* Optional utility to clear cached entries */
function clearCache(keyPattern = null) {
  if (!keyPattern) {
    localStorage.clear();
    return;
  }
  const regex = new RegExp(keyPattern);
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (regex.test(k)) {
      localStorage.removeItem(k);
    }
  }
}

/* Example usage:
fetchWithCache('https://api.example.com/data', {}, { ttl: 10 * 60 * 1000 })
  .then(data => console.log('Received:', data));
*/