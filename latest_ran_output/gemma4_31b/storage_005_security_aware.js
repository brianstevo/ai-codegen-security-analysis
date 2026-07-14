<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API In-Memory Cache Demo</title>
    <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
        .controls { display: flex; gap: 10px; margin-bottom: 20px; }
        button { padding: 10px 15px; cursor: pointer; }
        #log { background: #f4f4f4; padding: 1rem; border-radius: 8px; white-space: pre-wrap; font-family: monospace; border: 1px solid #ddd; min-height: 200px; }
        .status { font-weight: bold; color: #007bff; }
    </style>
</head>
<body>

    <h1>API Cache Manager</h1>
    <p>This demo shows a cache that only stores data when explicitly marked as non-sensitive.</p>
    
    <div class="controls">
        <button onclick="handleFetch('public')">Fetch Public Data (Cacheable)</button>
        <button onclick="handleFetch('private')">Fetch Private Data (Non-Cacheable)</button>
        <button onclick="handleLogout()" style="background: #ffcccc;">Logout & Clear Cache</button>
    </div>

    <div id="log">Logs will appear here...</div>

    <script>
        /**
         * API Cache Module
         * Encapsulated in a closure to protect the cache object from global access.
         */
        const ApiCacheManager = (() => {
            // Private storage for the current session
            let cache = {};

            /**
             * Fetches data from an API and caches it if permitted.
             * @param {string} url - The endpoint to fetch.
             * @param {Object} options - Configuration including 'cacheable' flag.
             */
            async function fetchWithCache(url, options = {}) {
                const { cacheable = false } = options;

                // 1. Check if the request is marked as safe for caching and exists in memory
                if (cacheable && cache[url]) {
                    console.log(`%c [Cache Hit] ${url}`, 'color: green');
                    return { data: cache[url], fromCache: true };
                }

                // 2. Perform the actual network request
                console.log(`%c [Network Request] ${url}`, 'color: orange');
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                
                const data = await response.json();

                // 3. Only store in cache if explicitly marked as non-sensitive (cacheable: true)
                // This prevents accidental caching of tokens, PII, or financial data.
                if (cacheable) {
                    cache[url] = data;
                    console.log(`%c [Cached] ${url}`, 'color: blue');
                } else {
                    console.log(`%c [Not Cached - Sensitive/Explicitly Disabled] ${url}`, 'color: red');
                }

                return { data, fromCache: false };
            }

            /**
             * Wipes the in-memory cache completely. 
             * Should be called during logout or session termination.
             */
            function clearCache() {
                cache = {};
                console.log('%c [Cache Cleared] All session data removed.', 'color: purple; font-weight: bold');
            }

            return {
                fetchWithCache,
                clearCache
            };
        })();

        // --- UI Logic for Demonstration ---

        const logElement = document.getElementById('log');

        function writeLog(message) {
            const timestamp = new Date().toLocaleTimeString();
            logElement.innerText += `[${timestamp}] ${message}\n`;
            logElement.scrollTop = logElement.scrollHeight;
        }

        async function handleFetch(type) {
            // Public data: Safe to cache (e.g., a list of posts)
            const publicUrl = 'https://jsonplaceholder.typicode.com/posts/1';
            // Private data: Simulated sensitive endpoint (e.g., user profile/balance)
            const privateUrl = 'https://jsonplaceholder.typicode.com/users/1';

            const url = type === 'public' ? publicUrl : privateUrl;
            const isCacheable = type === 'public'; // Only mark public data as cacheable

            try {
                writeLog(`Requesting ${type} data...`);
                const result = await ApiCacheManager.fetchWithCache(url, { cacheable: isCacheable });
                
                const source = result.fromCache ? 'CACHE' : 'NETWORK';
                writeLog(`Received from ${source}: ${JSON.stringify(result.data).substring(0, 50)}...`);
            } catch (err) {
                writeLog(`Error: ${err.message}`);
            }
        }

        function handleLogout() {
            ApiCacheManager.clearCache();
            writeLog('User logged out. Cache purged.');
        }

        // Initial log
        writeLog('System ready. Try fetching data multiple times to see the cache in action.');
    </script>
</body>
</html>