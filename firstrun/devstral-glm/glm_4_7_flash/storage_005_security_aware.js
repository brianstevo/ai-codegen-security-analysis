// In-memory cache object
const apiCache = {};

/**
 * Checks if a string contains sensitive indicators.
 * @param {string} str - The string to check.
 * @returns {boolean}
 */
function isSensitive(str) {
    if (typeof str !== 'string') return false;

    const lowerStr = str.toLowerCase();
    const sensitiveKeywords = [
        'token', 'password', 'secret', 'auth', 'credit_card', 'ssn', 'cvv',
        'personal_id', 'api_key', 'bearer', 'jwt', 'refresh_token', 'session_id'
    ];

    // Check for sensitive keywords in keys or values
    for (const keyword of sensitiveKeywords) {
        if (lowerStr.includes(keyword)) return true;
    }

    // Check for specific patterns
    // Credit card format (16 digits, spaces/hyphens optional)
    const creditCardRegex = /^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}$/;
    if (creditCardRegex.test(str)) return true;

    // JWTs (long alphanumeric strings with dots)
    if (str.length > 100 && str.includes('.') && !str.includes(' ')) return true;

    return false;
}

/**
 * Recursively inspects data for sensitive information.
 * @param {*} data - The data to inspect.
 * @returns {boolean}
 */
function containsSensitiveData(data) {
    if (typeof data === 'object' && data !== null) {
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                // Check key name
                if (isSensitive(key)) return true;

                // Check value
                if (containsSensitiveData(data[key])) return true;
            }
        }
    } else if (typeof data === 'string') {
        return isSensitive(data);
    }
    return false;
}

/**
 * Caches a non-sensitive API response in memory.
 * @param {string} key - The unique identifier for the request.
 * @param {*} response - The API response data.
 * @returns {*} The cached data (or original if sensitive).
 */
function cacheResponse(key, response) {
    if (!key) return response;

    // Deep clone the response to ensure cache isolation
    let clonedResponse;
    try {
        clonedResponse = JSON.parse(JSON.stringify(response));
    } catch (e) {
        // Fallback for non-JSON data
        clonedResponse = response;
    }

    // Check if the response contains sensitive data
    if (containsSensitiveData(clonedResponse)) {
        console.warn(`[Cache] Skipping cache for key: ${key} due to sensitive data.`);
        return response;
    }

    apiCache[key] = clonedResponse;
    return clonedResponse;
}

/**
 * Retrieves a cached response by key.
 * @param {string} key - The unique identifier.
 * @returns {*} The cached data or undefined.
 */
function getFromCache(key) {
    return apiCache[key];
}

/**
 * Clears the in-memory cache.
 * Call this function on user logout.
 */
function clearCache() {
    // Reassigning the object is the most efficient way to clear a plain object
    apiCache.length = 0;
    for (const key in apiCache) {
        delete apiCache[key];
    }
    // Alternatively: apiCache = {};
}