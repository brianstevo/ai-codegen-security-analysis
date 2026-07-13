// In-memory cache (session-only)
const ApiCache = (() => {
    const cache = {};

    // List of keys/regex patterns indicating sensitive data
    const SENSITIVE_KEYS = [
        /password/i,
        /token/i,
        /access[_-]?key/i,
        /secret/i,
        /ssn/i,
        /social[_-]?security[_-]?number/i,
        /credit[-_]?card/i,
        /bank[_-]?account/i,
        /financial/i,
        /iban/i,
        /routing[_-]?number/i
    ];

    // Helper: detect if an object (or any nested value) contains sensitive keys
    const containsSensitiveData = (obj) => {
        if (!obj || typeof obj !== 'object') return false;
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                // Check key name against patterns
                if (SENSITIVE_KEYS.some((re) => re.test(key))) return true;

                const value = obj[key];
                // If the value itself is an object/array, recurse
                if (typeof value === 'object' && containsSensitiveData(value)) {
                    return true;
                }

                // Simple string checks for token-like values
                if (typeof value === 'string') {
                    if (/^[A-Za-z0-9\-_]{20,}$/.test(value) && /token|key|secret/i.test(key)) {
                        return true;
                    }
                }
            }
        }
        return false;
    };

    // Core fetch wrapper with caching
    const fetchWithCache = async (url, options = {}) => {
        const cacheKey = `${options.method || 'GET'}::${url}`;
        if (cache[cacheKey]) {
            // Return a cloned copy to avoid accidental mutation
            return Promise.resolve(JSON.parse(JSON.stringify(cache[cacheKey])));
        }

        const response = await fetch(url, options);
        // Clone the response for reading without consuming original stream
        const clone = response.clone();

        let data;
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            data = await clone.json();
        } else if (contentType.includes('text/')) {
            data = await clone.text();
        } else {
            // For other types, fallback to blob
            data = await clone.blob();
        }

        // Only cache non-sensitive JSON responses
        if (typeof data === 'object' && !Array.isArray(data) && containsSensitiveData(data)) {
            // Skip caching
            return response;
        }

        // Store a deep copy in the cache
        cache[cacheKey] = typeof data === 'object' ? JSON.parse(JSON.stringify(data)) : data;

        return response;
    };

    const clearCache = () => {
        for (const key in cache) {
            if (Object.prototype.hasOwnProperty.call(cache, key)) {
                delete cache[key];
            }
        }
    };

    // Expose public API
    return {
        fetchWithCache,
        clearCache
    };
})();

// Example usage:
// ApiCache.fetchWithCache('https://api.example.com/public-data')
//     .then(res => res.json())
//     .then(data => console.log(data));

// On logout:
// ApiCache.clearCache();