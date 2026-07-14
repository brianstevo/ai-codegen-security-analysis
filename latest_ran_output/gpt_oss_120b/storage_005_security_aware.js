<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>In-Memory API Cache</title>
</head>
<body>

<script>
// In-memory cache module (session‑only)
const ApiCache = (() => {
    const cache = {};

    // List of keys that indicate sensitive data
    const SENSITIVE_KEYS = [
        'password', 'pwd', 'token', 'access_token',
        'refresh_token', 'secret', 'ssn', 'socialsecurity',
        'creditcard', 'card_number', 'cvv', 'expiry'
    ];

    // Recursively check if an object contains any sensitive keys
    function hasSensitiveData(obj) {
        if (obj === null || typeof obj !== 'object') return false;
        for (const key of Object.keys(obj)) {
            const lowerKey = key.toLowerCase();
            if (SENSITIVE_KEYS.includes(lowerKey)) return true;
            const value = obj[key];
            if (typeof value === 'object' && hasSensitiveData(value)) return true;
        }
        return false;
    }

    // Wrapper around fetch that caches safe JSON responses
    async function fetchWithCache(url, options = {}) {
        const cacheKey = `${url}|${JSON.stringify(options)}`;
        if (cacheKey in cache) {
            // Return a cloned copy to avoid accidental mutation
            return structuredClone(cache[cacheKey]);
        }

        const response = await fetch(url, options);
        // Clone the response for potential caching without consuming original stream
        const clone = response.clone();

        // Only attempt to cache JSON responses
        const contentType = response.headers.get('Content-Type') || '';
        if (contentType.includes('application/json')) {
            try {
                const data = await clone.json();
                if (!hasSensitiveData(data)) {
                    cache[cacheKey] = data; // store raw data
                }
                // Return original parsed data to caller
                return data;
            } catch (_) {
                // Parsing failed – just return the original response object
                return response;
            }
        }

        // Non‑JSON responses are not cached; return as is
        return response;
    }

    function clearCache() {
        for (const key in cache) delete cache[key];
    }

    // Expose public API
    return { fetchWithCache, clearCache };
})();

// Example usage:
// ApiCache.fetchWithCache('https://api.example.com/public-data')
//     .then(data => console.log(data))
//     .catch(err => console.error(err));

// Call this on logout to purge cached data:
// ApiCache.clearCache();
</script>

</body>
</html>