<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Response Cache Demo</title>
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; padding: 2rem; line-height: 1.5; max-width: 800px; margin: 0 auto; background: #f4f4f9; }
        .card { background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .controls { margin-bottom: 1rem; display: flex; gap: 10px; align-items: center; }
        #status { font-weight: bold; margin-left: 10px; }
        pre { background: #272822; color: #f8f8f2; padding: 1rem; border-radius: 5px; overflow-x: auto; min-height: 100px; }
        .cache-hit { color: green; }
        .cache-miss { color: blue; }
        button { cursor: pointer; padding: 8px 16px; border-radius: 4px; border: 1px solid #ccc; background: #fff; transition: background 0.2s; }
        button:hover { background: #eee; }
        .btn-primary { background: #007bff; color: white; border: none; }
        .btn-primary:hover { background: #0056b3; }
    </style>
</head>
<body>

    <div class="card">
        <h1>API Cache Manager</h1>
        <p>This demo fetches a random post from JSONPlaceholder. The first request hits the network, subsequent requests hit <code>localStorage</code> until the TTL expires.</p>
        
        <div class="controls">
            <button id="fetchBtn" class="btn-primary">Fetch Data</button>
            <button id="clearBtn">Clear Cache</button>
            <span id="status">Ready</span>
        </div>

        <pre id="output">// API response will appear here...</pre>
    </div>

    <script>
        /**
         * Fetches data from an API with localStorage caching.
         * @param {string} url - The endpoint to fetch.
         * @param {number} ttl - Time To Live in milliseconds (default 1 minute).
         */
        async function fetchWithCache(url, ttl = 60000) {
            const cacheKey = `api_cache_${url}`;
            const cachedItem = localStorage.getItem(cacheKey);

            if (cachedItem) {
                const parsedCache = JSON.parse(cachedItem);
                const now = new Date().getTime();

                // Check if the cached data is still valid based on TTL
                if (now < parsedCache.expiry) {
                    console.log('Returning cached response...');
                    return { data: parsedCache.value, source: 'cache' };
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
                    value: data,
                    expiry: new Date().getTime() + ttl
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

        const API_URL = 'https://jsonplaceholder.typicode.com/posts/' + Math.floor(Math.random() * 100 + 1);
        // Note: We use a fixed ID for the demo so you can actually see the cache working.
        const FIXED_API_URL = 'https://jsonplaceholder.typicode.com/posts/1';

        async function handleFetch() {
            status.textContent = 'Loading...';
            output.textContent = 'Fetching...';
            
            try {
                // Cache for 30 seconds for demonstration purposes
                const result = await fetchWithCache(FIXED_API_URL, 30000);
                
                output.textContent = JSON.stringify(result.data, null, 2);
                
                if (result.source === 'cache') {
                    status.innerHTML = '<span class="cache-hit">✓ Loaded from Cache</span>';
                } else {
                    status.innerHTML = '<span class="cache-miss">☁ Loaded from Network</span>';
                }
            } catch (err) {
                output.textContent = `Error: ${err.message}`;
                status.textContent = 'Failed';
            }
        }

        fetchBtn.addEventListener('click', handleFetch);

        clearBtn.addEventListener('click', () => {
            localStorage.clear();
            status.textContent = 'Cache Cleared';
            output.textContent = '// Cache cleared. Next request will hit network.';
        });
    </script>
</body>
</html>