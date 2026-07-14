<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LocalStorage API Cache Demo</title>
    <style>
        :root {
            --primary: #2563eb;
            --bg: #f8fafc;
            --card-bg: #ffffff;
            --text: #1e293b;
            --border: #e2e8f0;
            --success: #22c55e;
            --warning: #eab308;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--bg);
            color: var(--text);
            margin: 0;
            padding: 2rem;
            line-height: 1.5;
        }

        .container {
            max-width: 800px;
            margin: 0 auto;
        }

        header {
            margin-bottom: 2rem;
            text-align: center;
        }

        h1 { margin-bottom: 0.5rem; }
        p.subtitle { color: #64748b; }

        .controls {
            display: flex;
            gap: 1rem;
            margin-bottom: 2rem;
            justify-content: center;
            flex-wrap: wrap;
        }

        button {
            padding: 0.75rem 1.5rem;
            border: none;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            font-size: 1rem;
        }

        .btn-primary { background-color: var(--primary); color: white; }
        .btn-primary:hover { background-color: #1d4ed8; }
        
        .btn-danger { background-color: #ef4444; color: white; }
        .btn-danger:hover { background-color: #dc2626; }

        .stats-panel {
            background: var(--card-bg);
            padding: 1rem;
            border-radius: 8px;
            border: 1px solid var(--border);
            margin-bottom: 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .stat-item {
            text-align: center;
        }
        .stat-value { font-size: 1.5rem; font-weight: bold; color: var(--primary); }
        .stat-label { font-size: 0.875rem; color: #64748b; }

        .results-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 1.5rem;
        }

        .card {
            background: var(--card-bg);
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            transition: transform 0.2s;
        }

        .card:hover { transform: translateY(-2px); }

        .card img {
            width: 100%;
            height: 250px;
            object-fit: cover;
            background-color: #eee;
        }

        .card-body { padding: 1rem; }
        .card-title { font-weight: bold; margin-bottom: 0.5rem; display: block; }
        
        .badge {
            display: inline-block;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: bold;
            text-transform: uppercase;
        }

        .badge-cache { background-color: #dcfce7; color: #166534; }
        .badge-network { background-color: #fef9c3; color: #854d0e; }

        .log-area {
            margin-top: 2rem;
            background: #1e293b;
            color: #a5f3fc;
            padding: 1rem;
            border-radius: 6px;
            font-family: monospace;
            height: 150px;
            overflow-y: auto;
        }

        .log-entry { margin-bottom: 0.25rem; border-bottom: 1px solid #334155; padding-bottom: 0.25rem; }
    </style>
</head>
<body>

<div class="container">
    <header>
        <h1>API Response Cacher</h1>
        <p class="subtitle">Fetches data from JSONPlaceholder with localStorage caching.</p>
    </header>

    <div class="controls">
        <button id="fetchBtn" class="btn-primary">Fetch Posts (Cached)</button>
        <button id="clearCacheBtn" class="btn-danger">Clear Cache</button>
    </div>

    <div class="stats-panel">
        <div class="stat-item">
            <div class="stat-value" id="cacheCount">0</div>
            <div class="stat-label">Cached Items</div>
        </div>
        <div class="stat-item">
            <div class="stat-value" id="lastFetchTime">-</div>
            <div class="stat-label">Last Fetch</div>
        </div>
    </div>

    <div id="results" class="results-grid"></div>

    <div class="log-area" id="consoleLog">
        <div class="log-entry">System ready...</div>
    </div>
</div>

<script>
/**
 * Vanilla JavaScript API Caching Module
 */
const CacheManager = {
    // Configuration
    TTL: 5 * 60 * 1000, // Time To Live: 5 minutes in milliseconds
    storageKeyPrefix: 'api_cache_',

    /**
     * Generates a unique key for the URL
     */
    getKey(url) {
        return `${this.storageKeyPrefix}${btoa(encodeURIComponent(url))}`;
    },

    /**
     * Checks if a cached item exists and is valid (not expired)
     */
    get(url) {
        try {
            const key = this.getKey(url);
            const data = localStorage.getItem(key);
            
            if (!data) return null;

            const parsed = JSON.parse(data);
            const now = Date.now();

            // Check expiration
            if (now > parsed.expiry) {
                this.remove(url); // Clean up expired item
                log(`Cache expired for ${url}`);
                return null;
            }

            log(`Cache HIT: ${url} (Age: ${Math.round((now - parsed.timestamp)/1000)}s)`);
            return parsed.data;

        } catch (e) {
            console.error("Cache read error", e);
            return null;
        }
    },

    /**
     * Saves data to localStorage with expiration timestamp
     */
    set(url, data) {
        try {
            const key = this.getKey(url);
            const payload = {
                data: data,
                timestamp: Date.now(),
                expiry: Date.now() + this.TTL
            };
            localStorage.setItem(key, JSON.stringify(payload));
            log(`Cache SET: ${url}`);
            updateStats();
        } catch (e) {
            console.error("Cache write error", e);
        }
    },

    /**
     * Removes a specific item from cache
     */
    remove(url) {
        const key = this.getKey(url);
        localStorage.removeItem(key);
    },

    /**
     * Clears all API cache items
     */
    clearAll() {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(this.storageKeyPrefix)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
        log(`Cache cleared. Removed ${keysToRemove.length} items.`);
        updateStats();
    },

    /**
     * Counts current cached items
     */
    count() {
        let count = 0;
        for (let i = 0; i < localStorage.length; i++) {
            if (localStorage.key(i).startsWith(this.storageKeyPrefix)) {
                count++;
            }
        }
        return count;
    }
};

/**
 * Fetch Wrapper: Tries cache first, then network
 */
async function fetchWithCache(url) {
    // 1. Check Cache
    const cachedData = CacheManager.get(url);
    if (cachedData) {
        return { data: cachedData, source: 'cache' };
    }

    // 2. Fetch from Network
    log(`Fetching from network: ${url}`);
    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // 3. Save to Cache
        CacheManager.set(url, data);
        
        return { data: data, source: 'network' };

    } catch (error) {
        log(`Error fetching ${url}: ${error.message}`);
        throw error;
    }
}

// --- UI Logic ---

const fetchBtn = document.getElementById('fetchBtn');
const clearCacheBtn = document.getElementById('clearCacheBtn');
const resultsContainer = document.getElementById('results');
const consoleLog = document.getElementById('consoleLog');

function log(message) {
    const div = document.createElement('div');
    div.className = 'log-entry';
    const time = new Date().toLocaleTimeString();
    div.textContent = `[${time}] ${message}`;
    consoleLog.prepend(div);
}

function updateStats() {
    document.getElementById('cacheCount').textContent = CacheManager.count();
}

function renderPosts(posts, source) {
    resultsContainer.innerHTML = '';
    
    posts.forEach(post => {
        const card = document.createElement('div');
        card.className = 'card';
        
        const badgeClass = source === 'cache' ? 'badge-cache' : 'badge-network';
        const badgeText = source === 'cache' ? 'From Cache' : 'From Network';

        card.innerHTML = `
            <div class="card-body">
                <span class="badge ${badgeClass}">${badgeText}</span>
                <span class="card-title">#${post.id} - ${post.title.substring(0, 30)}...</span>
                <p style="font-size: 0.9rem; color: #64748b;">${post.body.substring(0, 100)}...</p>
            </div>
        `;
        resultsContainer.appendChild(card);
    });

    document.getElementById('lastFetchTime').textContent = new Date().toLocaleTimeString();
}

// Event Listeners
fetchBtn.addEventListener('click', async () => {
    fetchBtn.disabled = true;
    fetchBtn.textContent = 'Loading...';
    
    try {
        const url = 'https://jsonplaceholder.typicode.com/posts?_limit=6';
        const result = await fetchWithCache(url);
        renderPosts(result.data, result.source);
    } catch (e) {
        alert('Failed to load data');
    } finally {
        fetchBtn.disabled = false;
        fetchBtn.textContent = 'Fetch Posts (Cached)';
    }
});

clearCacheBtn.addEventListener('click', () => {
    CacheManager.clearAll();
    resultsContainer.innerHTML = '';
});

// Initialize stats on load
updateStats();

</script>
</body>
</html>