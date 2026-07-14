<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Cache Implementation</title>
    <style>
        body { font-family: system-ui, sans-serif; padding: 2rem; line-height: 1.5; max-width: 800px; margin: 0 auto; background: #f4f4f9; }
        .card { background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .controls { margin-bottom: 1rem; display: flex; gap: 10px; }
        button { padding: 10px 20px; cursor: pointer; border: none; border-radius: 4px; background: #007bff; color: white; font-weight: bold; }
        button.secondary { background: #6c757d; }
        #status { margin-top: 1rem; font-weight: bold; color: #555; }
        pre { background: #272822; color: #f8f8f2; padding: 1rem; border-radius: 4px; overflow-x: auto; min-height: 100px; }
    </style>
</head>
<body>

    <div class="card">
        <h1>API Response Caching</h1>
        <p>This demo fetches data from a public API. The first request is slow (network), subsequent requests are instant (localStorage) until the cache expires.</p>
        
        <div class="controls">
            <button id="fetchBtn">Fetch Data</button>
            <button id="clearBtn" class="secondary">Clear Cache</button>
        </div>

        <div id="status">Ready.</div>
        <pre id="output">// Response will appear here...</pre>
    </div>

    <script>
        /**
         * Fetches data from an API with localStorage caching logic.
         * @param {string} url - The endpoint to fetch.
         * @param {number} ttl - Time To Live in milliseconds (default 1 minute).
         */
        async function fetchWithCache(url, ttl = 60000) {
            const cacheKey = `api_cache_${url}`;
            const cachedItem = localStorage.getItem(cacheKey);

            if (cachedItem) {
                const parsedCache = JSON.parse(cachedItem);
                const now = Date.now();

                // Check if the cached data is still valid based on TTL
                if (now < parsedCache.expiry) {
                    console.log('Returning from cache...');
                    return { data: parsedCache.data, source: 'cache' };
                }
                
                // If expired, remove it
                localStorage.removeItem(cacheKey);
            }

            try {
                console.log('Fetching from network...');
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                
                const data = await response.json();

                // Store in localStorage with an expiry timestamp
                const cacheObject = {
                    data: data,
                    expiry: Date.now() + ttl
                };
                localStorage.setItem(cacheKey, JSON.stringify(cacheObject));

                return { data: data, source: 'network' };
            } catch (error) {
                console.error('Fetch error:', error);
                throw error;
            }
        }

        // --- UI Logic ---

        const fetchBtn = document.getElementById('fetchBtn');
        const clearBtn = document.getElementById('clearBtn');
        const output = document.getElementById('output');
        const status = document.getElementById('status');

        const API_URL = 'https://jsonplaceholder.typicode.com/posts/1';
        const CACHE_DURATION = 30000; // 30 seconds for demo purposes

        fetchBtn.addEventListener('click', async () => {
            status.textContent = 'Loading...';
            output.textContent = 'Fetching...';

            try {
                // We use a short TTL of 30s to demonstrate expiration easily
                const result = await fetchWithCache(API_URL, CACHE_DURATION);
                
                status.textContent = `Source: ${result.source.toUpperCase()} | Cache expires in 30s`;
                output.textContent = JSON.stringify(result.data, null, 2);
            } catch (err) {
                status.textContent = 'Error occurred!';
                output.textContent = err.message;
            }
        });

        clearBtn.addEventListener('click', () => {
            // Clear all keys starting with our prefix
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('api_cache_')) {
                    localStorage.removeItem(key);
                }
            });
            status.textContent = 'Cache cleared!';
            output.textContent = '// Cache emptied.';
        });
    </script>
</body>
</html>