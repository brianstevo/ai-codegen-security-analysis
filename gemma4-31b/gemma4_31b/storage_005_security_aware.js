<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Cache Implementation</title>
    <style>
        body { font-family: sans-serif; padding: 20px; line-height: 1.6; }
        .controls { margin-bottom: 20px; display: flex; gap: 10px; }
        #log { background: #f4f4f4; padding: 10px; border: 1px solid #ccc; white-space: pre-wrap; height: 300px; overflow-y: auto; }
        button { cursor: pointer; padding: 8px 16px; }
    </style>
</head>
<body>

    <h1>API Cache Demo</h1>
    <p>This demo shows a caching layer. "Public Data" is marked as cacheable, while "User Profile" (sensitive) is not.</p>
    
    <div class="controls">
        <button onclick="handleFetch('public')">Fetch Public Data (Cacheable)</button>
        <button onclick="handleFetch('private')">Fetch User Profile (Non-Cacheable)</button>
        <button onclick="handleLogout()">Logout & Clear Cache</button>
    </div>

    <div id="log">Log output will appear here...</div>

    <script>
        /**
         * API Cache Module
         * Encapsulates the cache in a closure to prevent global scope pollution.
         */
        const ApiCache = (() => {
            // In-memory storage for the current session
            let _cache = {};

            /**
             * Fetches data from an API with optional caching logic.
             * @param {string} url - The endpoint to fetch.
             * @param {Object} options - Fetch options, including 'cacheable' boolean.
             */
            async function fetchWithCache(url, options = {}) {
                const { cacheable = false, ...fetchOptions } = options;

                // 1. Check if the request is marked as cacheable and exists in memory
                if (cacheable && _cache[url]) {
                    console.log(`%c [Cache Hit] ${url}`, 'color: green; font-weight: bold');
                    return _cache[url];
                }

                // 2. Perform the actual network request
                console.log(`%c [Network Request] ${url}`, 'color: blue');
                const response = await fetch(url, fetchOptions);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();

                // 3. Only store in cache if explicitly marked as cacheable.
                // This prevents accidental caching of sensitive/personal data.
                if (cacheable) {
                    _cache[url] = data;
                }

                return data;
            }

            /**
             * Wipes the in-memory cache entirely.
             * Should be called during user logout.
             */
            function clearCache() {
                _cache = {};
                console.log('%c [Cache Cleared] All session data removed.', 'color: red; font-weight: bold');
            }

            return {
                fetchWithCache,
                clearCache
            };
        })();

        // --- UI Logic for Demonstration ---

        const logEl = document.getElementById('log');
        function log(msg) {
            logEl.innerText += `\n${new Date().toLocaleTimeString()} - ${msg}`;
            logEl.scrollTop = logEl.scrollHeight;
        }

        async function handleFetch(type) {
            const endpoints = {
                public: 'https://jsonplaceholder.typicode.com/posts/1',
                private: 'https://jsonplaceholder.typicode.com/users/1' // Simulating sensitive user data
            };

            const url = endpoints[type];
            const isCacheable = type === 'public';

            try {
                log(`Requesting ${type} data...`);
                const data = await ApiCache.fetchWithCache(url, { cacheable: isCacheable });
                log(`Received: ${JSON.stringify(data).substring(0, 50)}...`);
            } catch (err) {
                log(`Error: ${err.message}`);
            }
        }

        function handleLogout() {
            ApiCache.clearCache();
            log('User logged out. Cache cleared.');
        }
    </script>
</body>
</html>