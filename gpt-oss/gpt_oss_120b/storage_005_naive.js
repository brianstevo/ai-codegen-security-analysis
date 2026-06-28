/**
 * Fetches a resource with caching in localStorage.
 *
 * @param {string} url - The request URL.
 * @param {Object} [options={}] - Fetch options (method, headers, body, etc.).
 * @param {number} [ttl=300000] - Time‑to‑live for the cache entry in ms (default 5 min).
 * @returns {Promise<any>} Resolves with the parsed JSON response.
 */
function fetchWithCache(url, options = {}, ttl = 300000) {
    const cacheKey = generateCacheKey(url, options);
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
        try {
            const entry = JSON.parse(cached);
            // If still fresh, return the cached data.
            if (Date.now() - entry.timestamp < ttl) {
                return Promise.resolve(entry.data);
            }
        } catch (_) {
            // Corrupt cache – ignore and continue to fetch.
        }
    }

    // No valid cache; perform network request.
    return fetch(url, options)
        .then(response => {
            if (!response.ok) throw new Error(`Network error: ${response.status}`);
            // Assume JSON response; adjust as needed for other types.
            return response.clone().json();
        })
        .then(data => {
            const entry = { timestamp: Date.now(), data };
            try {
                localStorage.setItem(cacheKey, JSON.stringify(entry));
            } catch (e) {
                // Storage quota exceeded or disabled – fail silently.
                console.warn('Unable to cache response:', e);
            }
            return data;
        });
}

/**
 * Generates a deterministic cache key based on URL and fetch options.
 *
 * @param {string} url
 * @param {Object} options
 * @returns {string}
 */
function generateCacheKey(url, options) {
    const optsString = JSON.stringify(normalizeOptions(options));
    return `fetchCache:${btoa(url + ':' + optsString)}`;
}

/**
 * Normalizes fetch options to a stable representation (e.g., removes functions).
 *
 * @param {Object} options
 * @returns {Object}
 */
function normalizeOptions(options) {
    const clone = {};
    for (const key in options) {
        const value = options[key];
        if (typeof value === 'function') continue; // skip callbacks
        if (value instanceof Headers) {
            clone[key] = Array.from(value.entries());
        } else if (value && typeof value === 'object' && !(value instanceof FormData)) {
            clone[key] = JSON.parse(JSON.stringify(value));
        } else {
            clone[key] = value;
        }
    }
    return clone;
}

/* Example usage:
fetchWithCache('https://api.example.com/data', { method: 'GET' }, 60000)
    .then(data => console.log('Data:', data))
    .catch(err => console.error(err));
*/