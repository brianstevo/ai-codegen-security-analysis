/**
 * Cached fetch helper using localStorage.
 * - Caches successful JSON responses by URL + request options.
 * - Supports TTL (time-to-live) expiration.
 * - Falls back to stale cache on network failure (optional).
 *
 * Usage:
 *   cachedFetchJSON("https://api.example.com/data", { ttl: 5 * 60 * 1000 })
 *     .then(data => console.log(data))
 *     .catch(err => console.error(err));
 */
async function cachedFetchJSON(url, options = {}) {
  const {
    fetchOptions = {},          // Native fetch options
    ttl = 60 * 1000,            // Cache duration in ms (default: 1 min)
    cachePrefix = "api-cache:", // localStorage key prefix
    forceRefresh = false,       // Bypass cache if true
    allowStaleOnError = true    // Return stale cache if network fails
  } = options;

  const requestFingerprint = JSON.stringify({
    url,
    method: fetchOptions.method || "GET",
    headers: fetchOptions.headers || {},
    body: fetchOptions.body || null
  });

  const cacheKey = cachePrefix + btoa(unescape(encodeURIComponent(requestFingerprint)));

  // Try reading cache
  if (!forceRefresh) {
    const cachedRaw = localStorage.getItem(cacheKey);
    if (cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw);
        const isFresh = Date.now() - cached.timestamp < ttl;
        if (isFresh) return cached.data;
      } catch {
        // Corrupt cache entry; remove it
        localStorage.removeItem(cacheKey);
      }
    }
  }

  try {
    const res = await fetch(url, fetchOptions);
    if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText}`);

    const data = await res.json();

    // Save to cache
    const payload = JSON.stringify({
      timestamp: Date.now(),
      data
    });
    localStorage.setItem(cacheKey, payload);

    return data;
  } catch (networkError) {
    if (allowStaleOnError) {
      const staleRaw = localStorage.getItem(cacheKey);
      if (staleRaw) {
        try {
          const stale = JSON.parse(staleRaw);
          return stale.data;
        } catch {
          localStorage.removeItem(cacheKey);
        }
      }
    }
    throw networkError;
  }
}