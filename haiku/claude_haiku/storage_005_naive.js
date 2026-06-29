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
            margin: 50px auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        button {
            background-color: #4CAF50;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            margin: 5px 5px 5px 0;
            font-size: 14px;
        }
        button:hover {
            background-color: #45a049;
        }
        .result {
            margin-top: 20px;
            padding: 15px;
            background-color: #f9f9f9;
            border-left: 4px solid #4CAF50;
            border-radius: 4px;
        }
        .error {
            border-left-color: #f44336;
            background-color: #ffebee;
        }
        .cached {
            border-left-color: #2196F3;
            background-color: #e3f2fd;
        }
        .loading {
            color: #666;
            font-style: italic;
        }
        pre {
            background-color: #f4f4f4;
            padding: 10px;
            border-radius: 4px;
            overflow-x: auto;
            max-height: 300px;
            overflow-y: auto;
        }
        .controls {
            margin: 20px 0;
        }
        input {
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            margin-right: 10px;
        }
        .cache-info {
            margin-top: 20px;
            padding: 10px;
            background-color: #e8f5e9;
            border-radius: 4px;
        }
        .cache-item {
            padding: 8px;
            margin: 5px 0;
            background-color: white;
            border-left: 3px solid #4CAF50;
            border-radius: 3px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>API Cache Demo</h1>
        <p>This demo shows how to cache API responses in localStorage for faster subsequent requests.</p>
        
        <div class="controls">
            <input type="text" id="urlInput" placeholder="Enter API URL (e.g., https://api.github.com/users/torvalds)" value="https://api.github.com/users/torvalds">
            <button onclick="fetchData()">Fetch Data</button>
            <button onclick="clearCache()">Clear Cache</button>
        </div>
        
        <div id="result"></div>
        
        <div class="cache-info">
            <h3>Cache Contents:</h3>
            <div id="cacheList"></div>
        </div>
    </div>

    <script>
        // API Cache Manager with localStorage
        class APICache {
            constructor(cacheName = 'api_cache', ttl = 5 * 60 * 1000) {
                this.cacheName = cacheName;
                this.ttl = ttl; // Time to live in milliseconds (default: 5 minutes)
            }

            // Generate cache key from URL
            generateKey(url) {
                return `${this.cacheName}:${url}`;
            }

            // Check if cache entry is still valid
            isValid(cacheEntry) {
                if (!cacheEntry) return false;
                const now = Date.now();
                return (now - cacheEntry.timestamp) < this.ttl;
            }

            // Get data from cache
            get(url) {
                const key = this.generateKey(url);
                try {
                    const cached = localStorage.getItem(key);
                    if (!cached) return null;

                    const cacheEntry = JSON.parse(cached);
                    if (!this.isValid(cacheEntry)) {
                        localStorage.removeItem(key);
                        return null;
                    }

                    return cacheEntry.data;
                } catch (error) {
                    console.error('Cache read error:', error);
                    return null;
                }
            }

            // Store data in cache
            set(url, data) {
                const key = this.generateKey(url);
                try {
                    const cacheEntry = {
                        data: data,
                        timestamp: Date.now(),
                        url: url
                    };
                    localStorage.setItem(key, JSON.stringify(cacheEntry));
                    return true;
                } catch (error) {
                    console.error('Cache write error:', error);
                    // Handle quota exceeded by clearing old entries
                    if (error.name === 'QuotaExceededError') {
                        this.clearExpired();
                        try {
                            const cacheEntry = {
                                data: data,
                                timestamp: Date.now(),
                                url: url
                            };
                            localStorage.setItem(key, JSON.stringify(cacheEntry));
                            return true;
                        } catch {
                            return false;
                        }
                    }
                    return false;
                }
            }

            // Clear expired cache entries
            clearExpired() {
                try {
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key && key.startsWith(this.cacheName)) {
                            const cached = localStorage.getItem(key);
                            const cacheEntry = JSON.parse(cached);
                            if (!this.isValid(cacheEntry)) {
                                localStorage.removeItem(key);
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error clearing expired cache:', error);
                }
            }

            // Clear all cache entries for this cache name
            clear() {
                try {
                    const keysToRemove = [];
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key && key.startsWith(this.cacheName)) {
                            keysToRemove.push(key);
                        }
                    }
                    keysToRemove.forEach(key => localStorage.removeItem(key));
                    return true;
                } catch (error) {
                    console.error('Cache clear error:', error);
                    return false;
                }
            }

            // Get all cache entries
            getAll() {
                const entries = [];
                try {
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key && key.startsWith(this.cacheName)) {
                            const cached = localStorage.getItem(key);
                            const cacheEntry = JSON.parse(cached);
                            entries.push({
                                key: key,
                                url: cacheEntry.url,
                                timestamp: new Date(cacheEntry.timestamp).toLocaleString(),
                                size: cached.length
                            });
                        }
                    }
                } catch (error) {
                    console.error('Error getting all cache entries:', error);
                }
                return entries;
            }
        }

        // Create cache instance
        const cache = new APICache('api_cache', 5 * 60 * 1000); // 5 minute TTL

        // Fetch data with caching