// Configuration for sensitive data detection
const SENSITIVE_PATTERNS = [
    'token', 'password', 'secret', 'ssn', 'credit_card', 'cvv', 'pin', 'auth', 'bearer', 'api_key', 'refresh_token'
];

/**
 * Recursively checks if an object contains sensitive data.
 * @param {*} data - The data to inspect.
 * @returns {boolean} - True if sensitive data is found.
 */
function isSensitiveData(data) {
    if (typeof data !== 'object' || data === null) {
        return false;
    }

    for (const key in data) {
        const val = data[key];
        const keyLower = key.toLowerCase();

        // Check key name for sensitive indicators
        if (SENSITIVE_PATTERNS.some(pattern => keyLower.includes(pattern))) {
            return true;
        }

        // Check value for sensitive indicators
        if (typeof val === 'string' && SENSITIVE_PATTERNS.some(pattern => val.toLowerCase().includes(pattern))) {
            return true;
        }

        // Recursively check nested objects
        if (isSensitiveData(val)) {
            return true;
        }
    }
    return false;
}

/**
 * In-memory cache manager for API responses.
 */
class APICache {
    constructor() {
        this.cache = {};
    }

    /**
     * Stores a response in the cache if it is not sensitive.
     * @param {string} key - The cache key.
     * @param {*} response - The API response object.
     */
    set(key, response) {
        if (isSensitiveData(response)) {
            console.warn(`[APICache] Skipping cache for sensitive data key: ${key}`);
            return;
        }
        this.cache[key] = response;
    }

    /**
     * Retrieves a response from the cache.
     * @param {string} key - The cache key.
     * @returns {*} The cached response or undefined.
     */
    get(key) {
        return this.cache[key];
    }

    /**
     * Clears all cached data.
     * Should be called on logout.
     */
    clearCache() {
        this.cache = {};
    }
}

// Initialize the cache instance
const apiCache = new APICache();

// Expose clearCache globally for easy access during logout
window.clearCache = () => apiCache.clearCache();