```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Cache Manager</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
        }
        .section {
            margin-bottom: 30px;
            padding: 15px;
            border: 1px solid #ccc;
            border-radius: 5px;
        }
        button {
            padding: 8px 16px;
            margin: 5px 5px 5px 0;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        button:hover {
            background-color: #45a049;
        }
        button.danger {
            background-color: #f44336;
        }
        button.danger:hover {
            background-color: #da190b;
        }
        input {
            padding: 8px;
            margin: 5px 5px 5px 0;
            border: 1px solid #ddd;
            border-radius: 4px;
            width: 300px;
        }
        .result {
            background-color: #f9f9f9;
            padding: 10px;
            border-left: 4px solid #4CAF50;
            margin-top: 10px;
            border-radius: 4px;
        }
        .error {
            background-color: #ffebee;
            border-left-color: #f44336;
            color: #c62828;
        }
        .cache-info {
            background-color: #e8f5e9;
            padding: 10px;
            border-radius: 4px;
            margin-top: 10px;
        }
        pre {
            background-color: #f5f5f5;
            padding: 10px;
            border-radius: 4px;
            overflow-x: auto;
        }
    </style>
</head>
<body>
    <h1>API Cache Manager Demo</h1>
    
    <div class="section">
        <h2>Safe API Caching</h2>
        <p>This demo shows how to safely cache API responses while avoiding sensitive data.</p>
        
        <h3>Test Safe Cache (Public Data)</h3>
        <input type="text" id="safeUrl" placeholder="Enter a safe API URL" value="https://api.github.com/repos/facebook/react">
        <button onclick="testSafeCache()">Fetch & Cache Safe Data</button>
        <div id="safeResult"></div>
        
        <h3>Test Blocked Cache (Sensitive Data)</h3>
        <input type="text" id="sensitiveUrl" placeholder="Enter a sensitive API URL" value="https://api.example.com/user/profile">
        <button onclick="testBlockedCache()">Try to Cache Sensitive Data</button>
        <div id="sensitiveResult"></div>
        
        <h3>Cache Status</h3>
        <button onclick="displayCacheStatus()">Show Cache Contents</button>
        <button onclick="displayCacheStats()">Show Cache Statistics</button>
        <div id="cacheStatus"></div>
    </div>
    
    <div class="section">
        <h2>Cache Management</h2>
        <button class="danger" onclick="performLogout()">Logout (Clear Cache)</button>
        <div id="logoutStatus"></div>
    </div>

    <script>
        // In-memory cache for non-sensitive API responses
        const apiCache = {};
        
        // Patterns that indicate sensitive data - these should NOT be cached
        const sensitivePatterns = [
            /password/i,
            /token/i,
            /secret/i,
            /api[_-]?key/i,
            /auth/i,
            /credit[_-]?card/i,
            /ssn/i,
            /social[_-]?security/i,
            /financial/i,
            /bank/i,
            /account[_-]?number/i,
            /routing[_-]?number/i,
            /personal/i,
            /private/i,
            /confidential/i,
            /security/i,
            /signature/i,
            /private[_-]?key/i,
            /public[_-]?key/i,
            /jwt/i,
            /bearer/i,
            /oauth/i,
            /user[_-]?id/i,
            /user[_-]?name/i,
            /email/i,
            /phone/i,
            /address/i,
            /salary/i,
            /income/i
        ];
        
        /**
         * Checks if a response contains sensitive data
         * @param {*} data - The response data to check
         * @param {string} url - The API URL
         * @returns {boolean} - True if data contains sensitive information
         */
        function containsSensitiveData(data, url) {
            // Check URL for sensitive patterns
            if (sensitivePatterns.some(pattern => pattern.test(url))) {
                return true;
            }
            
            // Check response data for sensitive keys
            if (typeof data === 'object' && data !== null) {
                const dataString = JSON.stringify(data).toLowerCase();
                if (sensitivePatterns.some(pattern => pattern.test(dataString))) {
                    return true;
                }
            }
            
            return false;
        }
        
        /**
         * Generates a cache key from a URL
         * @param {string} url - The API URL
         * @returns {string} - Cache key
         */
        function generateCacheKey(url) {
            return url;
        }
        
        /**
         * Fetches data from API and caches if safe
         * @param {string} url - The API URL to fetch from
         * @param {object} options - Fetch options
         * @returns {Promise} - Promise that resolves with the data
         */
        async function fetchWithCache(url, options = {}) {
            const cacheKey = generateCacheKey(url);
            
            // Check if data is in cache
            if (apiCache[cacheKey]) {
                console.log(`Cache hit for: ${url}`);
                return apiCache[cacheKey];
            }
            
            try {
                const response = await fetch(url, options);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                
                // Check if response contains sensitive data
                if (containsSensitiveData(data, url)) {
                    console.warn(`Sensitive data detected in response from ${url} - NOT CACHING`);
                    return data; // Return data but don't cache it
                }
                
                // Cache the response if it's safe
                apiCache[cacheKey] = data;
                console.log(`Cached response from: ${url}`);
                
                return data;
            } catch (error) {
                console.error(`Error fetching from ${url}:`, error);
                throw error;
            }
        }
        
        /**
         * Clears the entire cache (called on logout)
         */
        function clearCache() {
            const keysCleared = Object.keys(apiCache).length;
            for (const key in apiCache) {
                delete apiCache[key];
            }
            console.log(`Cache cleared. Removed ${keysCleared} entries.`);
            return keysCleared;
        }
        
        /**
         * Gets cache statistics
         * @returns {object} - Cache statistics
         */
        function getCacheStats() {
            const entries = Object.keys(apiCache);
            const totalSize = entries.reduce((sum, key) => {
                return sum + JSON.stringify(