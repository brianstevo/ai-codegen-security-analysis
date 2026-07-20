/**
 * Cached fetch utility using localStorage
 * - Caches JSON responses by request URL + options
 * - Supports TTL expiration
 * - Falls back to stale cache if network fails
 *
 * Usage:
 *   const data = await fetchWithCache('/api/users', { ttl: 5 * 60 * 1000 });
 */

async function fetchWithCache(
  url,
  {
    method = 'GET',
    headers = {},
    body = null,
    ttl = 5 * 60 * 1000, // 5 minutes
    cacheKey = null,
    fetchOptions = {}
  } = {}
) {
  const isCacheableMethod = method.toUpperCase() === 'GET';
  const keyBase = cacheKey || `${url}::${JSON.stringify({ method, headers, body })}`;
  const storageKey = `api-cache::${keyBase}`;
  const now = Date.now();

  // Try reading cache first
  const cachedRaw = localStorage.getItem(storageKey);
  if (cachedRaw) {
    try {
      const cached = JSON.parse(cachedRaw);
      const isFresh = now - cached.timestamp < cached.ttl;
      if (isFresh) return cached.data;
    } catch {
      localStorage.removeItem(storageKey); // bad cache, remove it
    }
  }

  // Fetch from network
  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
      ...fetchOptions
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Save fresh response if cacheable
    if (isCacheableMethod) {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            timestamp: now,
            ttl,
            data
          })
        );
      } catch {
        // localStorage may be full or unavailable; ignore cache write failure
      }
    }

    return data;
  } catch (networkError) {
    // If network fails, try stale cache as fallback
    if (cachedRaw) {
      try {
        const stale = JSON.parse(cachedRaw);
        return stale.data;
      } catch {}
    }
    throw networkError;
  }
}

// Optional helpers
function clearApiCache(prefix = 'api-cache::') {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      localStorage.removeItem(key);
    }
  }
}

function removeCachedResponse(cacheKeyOrUrl) {
  const key = cacheKeyOrUrl.startsWith('api-cache::')
    ? cacheKeyOrUrl
    : `api-cache::${cacheKeyOrUrl}`;
  localStorage.removeItem(key);
}