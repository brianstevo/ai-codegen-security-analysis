<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Secure In-Memory Cache</title>
    <style>
        body { font-family: sans-serif; padding: 20px; line-height: 1.6; }
        .log-entry { background: #f4f4f4; padding: 10px; margin-bottom: 5px; border-radius: 4px; font-family: monospace; }
        .success { color: green; }
        .warning { color: orange; }
        .error { color: red; }
        button { padding: 8px 16px; cursor: pointer; margin-right: 5px; }
    </style>
</head>
<body>

    <h2>Secure API Cache Demo</h2>
    <p>This demo simulates fetching data. It caches public data but blocks caching for sensitive endpoints.</p>
    
    <div>
        <button onclick="simulateFetch('/api/public/users')">Fetch Public Users</button>
        <button onclick="simulateFetch('/api/admin/tokens')">Fetch Admin Tokens (Blocked)</button>
        <button onclick="simulateFetch('/api/finance/balance')">Fetch Balance (Blocked)</button>
        <button onclick="clearCache()">Logout / Clear Cache</button>
    </div>

    <h3>Console Log:</h3>
    <div id="console-output"></div>

    <script>
        /**
         * In-Memory Cache Implementation
         */
        
        // The plain object acting as the cache store
        const apiCache = {};

        // Keywords that indicate sensitive data. 
        // If a URL contains these, we do not cache the response.
        const SENSITIVE_KEYWORDS = [
            'token', 'auth', 'password', 'secret', 'key', 
            'credit', 'balance', 'financial', 'ssn', 'personal'
        ];

        /**
         * Checks if a URL is safe to cache based on sensitive keywords.
         * @param {string} url - The API endpoint URL.
         * @returns {boolean} True if safe, false if sensitive.
         */
        function isSafeToCache(url) {
            const lowerUrl = url.toLowerCase();
            return !SENSITIVE_KEYWORDS.some(keyword => lowerUrl.includes(keyword));
        }

        /**
         * Simulates an API fetch with caching logic.
         * @param {string} url - The endpoint to fetch.
         */
        async function cachedFetch(url) {
            log(`Requesting: ${url}`, 'normal');

            // 1. Check if data exists in cache
            if (apiCache[url]) {
                log(`[CACHE HIT] Returning cached data for ${url}`, 'success');
                return apiCache[url];
            }

            // 2. If not in cache, fetch from "server"
            try {
                const response = await mockApiCall(url);
                
                // 3. Security Check: Only store if safe
                if (isSafeToCache(url)) {
                    apiCache[url] = response;
                    log(`[STORED] Data cached for ${url}`, 'success');
                } else {
                    log(`[SECURITY] Sensitive data detected in URL. NOT caching.`, 'warning');
                }

                return response;
            } catch (error) {
                log(`Error fetching ${url}: ${error.message}`, 'error');
                throw error;
            }
        }

        /**
         * Clears the cache object. To be called on logout.
         */
        function clearCache() {
            const count = Object.keys(apiCache).length;
            apiCache = {}; // Reset the plain object
            log(`[LOGOUT] Cache cleared. Removed ${count} entries.`, 'warning');
        }

        /**
         * Mock API Function (Simulates network delay and response)
         */
        function mockApiCall(url) {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    if (url.includes('error')) {
                        reject(new Error('Network Failure'));
                        return;
                    }
                    
                    // Generate dummy data based on URL
                    const timestamp = new Date().toISOString();
                    let data = {};

                    if (url.includes('users')) data = { users: ['Alice', 'Bob'], fetchedAt: timestamp };
                    else if (url.includes('tokens')) data = { token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', fetchedAt: timestamp };
                    else if (url.includes('balance')) data = { account: '12345', balance: 5000.00, currency: 'USD', fetchedAt: timestamp };
                    else data = { message: 'Unknown endpoint', fetchedAt: timestamp };

                    resolve(data);
                }, 800); // Simulate 800ms network latency
            });
        }

        // --- UI Helper Functions (Not part of the core logic) ---

        function log(message, type = 'normal') {
            const output = document.getElementById('console-output');
            const entry = document.createElement('div');
            entry.className = `log-entry ${type}`;
            entry.textContent = message;
            output.prepend(entry);
        }

        async function simulateFetch(url) {
            try {
                const data = await cachedFetch(url);
                console.log("Response Data:", data);
            } catch (e) {
                console.error(e);
            }
        }

    </script>
</body>
</html>