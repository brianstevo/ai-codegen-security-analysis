```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Cache Demo</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .button-group {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }
        button {
            padding: 10px 20px;
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        }
        button:hover {
            background-color: #0056b3;
        }
        button.danger {
            background-color: #dc3545;
        }
        button.danger:hover {
            background-color: #c82333;
        }
        button.success {
            background-color: #28a745;
        }
        button.success:hover {
            background-color: #218838;
        }
        .result {
            background-color: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            padding: 15px;
            margin-top: 20px;
        }
        .result h3 {
            margin-top: 0;
            color: #333;
        }
        .status {
            padding: 10px;
            border-radius: 4px;
            margin-top: 10px;
        }
        .status.cached {
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .status.fresh {
            background-color: #cce5ff;
            color: #004085;
            border: 1px solid #b8daff;
        }
        .status.error {
            background-color: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .loading {
            color: #666;
            font-style: italic;
        }
        pre {
            background-color: #f5f5f5;
            padding: 10px;
            border-radius: 4px;
            overflow-x: auto;
            max-height: 300px;
            overflow-y: auto;
        }
        .cache-stats {
            background-color: #e7f3ff;
            padding: 10px;
            border-radius: 4px;
            margin-top: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>API Cache Demo</h1>
        <p>This demo shows how to cache API responses in localStorage for faster subsequent requests.</p>
        
        <div class="button-group">
            <button onclick="fetchUser(1)">Fetch User 1 (Cached)</button>
            <button onclick="fetchUser(2)">Fetch User 2 (Cached)</button>
            <button onclick="fetchPosts(1)">Fetch Posts (5 min cache)</button>
            <button onclick="fetchWithoutCache()">Fetch Without Cache</button>
            <button class="danger" onclick="clearAllCache()">Clear Cache</button>
            <button class="success" onclick="showCacheStats()">Show Cache Stats</button>
        </div>

        <div id="result" class="result" style="display: none;"></div>
    </div>

    <script>
        // Cache configuration with expiration times
        const cacheConfig = {
            users: { expiration: 3600000 }, // 1 hour
            posts: { expiration: 300000 },  // 5 minutes
            default: { expiration: 600000 } // 10 minutes
        };

        /**
         * Create a cache key from URL and parameters
         */
        function createCacheKey(url, params = {}) {
            const paramStr = Object.keys(params)
                .sort()
                .map(key => `${key}=${encodeURIComponent(params[key])}`)
                .join('&');
            return paramStr ? `${url}?${paramStr}` : url;
        }

        /**
         * Get cached data if valid
         */
        function getCached(key) {
            try {
                const cached = localStorage.getItem(`cache_${key}`);
                if (!cached) return null;

                const data = JSON.parse(cached);
                const now = Date.now();

                // Check if cache has expired
                if (data.expiredAt && data.expiredAt < now) {
                    localStorage.removeItem(`cache_${key}`);
                    return null;
                }

                return data;
            } catch (error) {
                console.error('Error reading cache:', error);
                return null;
            }
        }

        /**
         * Store data in cache with expiration
         */
        function setCached(key, data, expirationMs) {
            try {
                const cacheData = {
                    data: data,
                    cachedAt: Date.now(),
                    expiredAt: Date.now() + expirationMs
                };
                localStorage.setItem(`cache_${key}`, JSON.stringify(cacheData));
            } catch (error) {
                console.error('Error setting cache:', error);
            }
        }

        /**
         * Fetch API with caching
         */
        async function fetchWithCache(url, options = {}) {
            const {
                params = {},
                cacheKey = null,
                expirationMs = cacheConfig.default.expiration,
                bypassCache = false,
                methodOverride = 'GET'
            } = options;

            const key = cacheKey || createCacheKey(url, params);

            // Check cache first if not bypassing
            if (!bypassCache) {
                const cached = getCached(key);
                if (cached) {
                    return {
                        ...cached,
                        fromCache: true,
                        cacheKey: key
                    };
                }
            }

            // Fetch from API
            try {
                const queryString = new URLSearchParams(params).toString();
                const fullUrl = queryString ? `${url}?${queryString}` : url;

                const response = await fetch(fullUrl, {
                    method: methodOverride,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error(`API error: ${response.status}`);
                }

                const data = await response.json();

                // Cache the response
                setCached(key, data, expirationMs);

                return {
                    data: data,
                    cachedAt: Date.now(),
                    expiredAt: Date.now() + expirationMs,
                    fromCache: false,
                    cacheKey: key
                };
            } catch (error) {
                console.error('Fetch error:', error);
                throw error;
            }
        }

        /**
         * Display result in UI
         */
        function displayResult(title, data, isFromCache, cacheKey) {
            const resultDiv = document.getElementById('result');
            const cacheStatus = isFromCache
                ? `<div class="status cached">✓ Data loaded from cache (Key: ${cacheKey})</div>`
                : `<div class="status fresh">✓ Fresh data from API (Key: ${cacheKey})</div>`;

            const responseTime = isFromCache ? '