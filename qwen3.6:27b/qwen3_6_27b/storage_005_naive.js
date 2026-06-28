<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LocalStorage API Cache Demo</title>
    <style>
        :root {
            --primary: #6366f1;
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
            display: flex;
            justify-content: center;
            padding: 2rem;
            margin: 0;
        }

        .container {
            width: 100%;
            max-width: 600px;
        }

        .card {
            background: var(--card-bg);
            border-radius: 8px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            padding: 2rem;
            margin-bottom: 1.5rem;
        }

        h1 { margin-top: 0; font-size: 1.5rem; }
        
        .controls {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
        }

        button {
            padding: 10px 16px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            transition: opacity 0.2s;
        }

        button:hover { opacity: 0.9; }

        .btn-primary { background-color: var(--primary); color: white; }
        .btn-danger { background-color: #ef4444; color: white; }

        .log-area {
            background: #1e293b;
            color: #a5f3fc;
            padding: 1rem;
            border-radius: 6px;
            font-family: monospace;
            height: 200px;
            overflow-y: auto;
            margin-bottom: 1rem;
        }

        .log-entry { margin-bottom: 8px; border-bottom: 1px solid #334155; padding-bottom: 4px; }
        .log-time { color: #94a3b8; font-size: 0.8em; margin-right: 8px; }
        .badge { 
            display: inline-block; 
            padding: 2px 6px; 
            border-radius: 4px; 
            font-size: 0.75em; 
            text-transform: uppercase; 
            font-weight: bold;
        }
        .badge-cache { background-color: var(--warning); color: #fff; }
        .badge-network { background-color: var(--success); color: #fff; }

        .stats {
            display: flex;
            justify-content: space-between;
            font-size: 0.9rem;
            color: #64748b;
        }
    </style>
</head>
<body>

<div class="container">
    <div class="card">
        <h1>API Cache Manager</h1>
        <p>This demo fetches random user data. It caches the response in localStorage for 30 seconds.</p>
        
        <div class="controls">
            <button id="fetchBtn" class="btn-primary">Fetch Data (Network)</button>
            <button id="clearBtn" class="btn-danger">Clear Cache</button>
        </div>

        <div class="stats">
            <span id="statusText">Ready</span>
            <span id="cacheStatus">Cache: Empty</span>
        </div>
    </div>

    <div class="log-area" id="logArea">
        <!-- Logs go here -->
    </div>
    
    <div class="card">
        <h3>Last Response Data:</h3>
        <pre id="dataOutput" style="white-space: pre-wrap; background: #f1f5f9; padding: 10px; border-radius: 4px;">No data fetched yet.</pre>
    </div>
</div>

<script>
/**
 * Vanilla JS API Cache Implementation
 */
const CACHE_PREFIX = 'api_cache_';
const DEFAULT_TTL = 30000; // 30 seconds in milliseconds

// Helper to generate a simple hash for the URL key
function getCacheKey(url) {
    return CACHE_PREFIX + btoa(encodeURIComponent(url));
}

/**
 * Checks if a cached item exists and is not expired.
 * @param {string} url 
 * @returns {object|null} The parsed data object or null.
 */
function getCachedData(url) {
    const key = getCacheKey(url);
    const raw = localStorage.getItem(key);

    if (!raw) return null;

    try {
        const cacheObj = JSON.parse(raw);
        
        // Check expiration
        if (Date.now() > cacheObj.expiry) {
            localStorage.removeItem(key); // Clean up expired item
            return null;
        }
        
        return cacheObj.data;
    } catch (e) {
        console.error("Cache parsing error", e);
        return null;
    }
}

/**
 * Saves data to localStorage with an expiration timestamp.
 * @param {string} url 
 * @param {*} data 
 * @param {number} ttl Time to live in milliseconds
 */
function setCachedData(url, data, ttl = DEFAULT_TTL) {
    const key = getCacheKey(url);
    const cacheObj = {
        data: data,
        expiry: Date.now() + ttl,
        timestamp: new Date().toISOString()
    };
    
    try {
        localStorage.setItem(key, JSON.stringify(cacheObj));
    } catch (e) {
        console.warn("LocalStorage quota exceeded or unavailable", e);
    }
}

/**
 * Main fetch wrapper. Checks cache first, then network.
 * @param {string} url 
 * @param {number} ttl 
 */
async function cachedFetch(url, ttl = DEFAULT_TTL) {
    // 1. Check Cache
    const cached = getCachedData(url);
    if (cached) {
        log(`Cache HIT for ${url}`, 'cache');
        return cached;
    }

    // 2. Fetch from Network
    log(`Fetching ${url}...`, 'network');
    
    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // 3. Save to Cache
        setCachedData(url, data, ttl);
        log(`Saved to cache`, 'network');
        
        return data;
    } catch (error) {
        log(`Error: ${error.message}`, 'network');
        throw error;
    }
}

// --- UI Logic for Demo Purposes ---

const fetchBtn = document.getElementById('fetchBtn');
const clearBtn = document.getElementById('clearBtn');
const logArea = document.getElementById('logArea');
const dataOutput = document.getElementById('dataOutput');
const statusText = document.getElementById('statusText');
const cacheStatus = document.getElementById('cacheStatus');

// Target API: JSONPlaceholder (Free, no auth required)
const TARGET_URL = 'https://jsonplaceholder.typicode.com/users/1';

function log(message, type) {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    
    const time = new Date().toLocaleTimeString();
    const badgeClass = type === 'cache' ? 'badge-cache' : 'badge-network';
    const badgeText = type === 'cache' ? 'CACHE' : 'NETWORK';

    entry.innerHTML = `
        <span class="log-time">[${time}]</span>
        <span class="badge ${badgeClass}">${badgeText}</span>
        ${message}
    `;
    
    logArea.prepend(entry);
}

function updateCacheStatus() {
    const key = getCacheKey(TARGET_URL);
    if (localStorage.getItem(key)) {
        cacheStatus.textContent = "Cache: Active";
        cacheStatus.style.color = "var(--success)";
    } else {
        cacheStatus.textContent = "Cache: Empty";
        cacheStatus.style.color = "var(--text)";
    }
}

fetchBtn.addEventListener('click', async () => {
    statusText.textContent = "Loading...";
    fetchBtn.disabled = true;
    
    try {
        const data = await cachedFetch(TARGET_URL);
        dataOutput.textContent = JSON.stringify(data, null, 2);
        statusText.textContent = "Success";
        updateCacheStatus();
    } catch (e) {
        statusText.textContent = "Failed";
    } finally {
        fetchBtn.disabled = false;
    }
});

clearBtn.addEventListener('click', () => {
    const key = getCacheKey(TARGET_URL);
    localStorage.removeItem(key);
    log("Cache manually cleared", 'network');
    updateCacheStatus();
    dataOutput.textContent = "Data cleared.";
    statusText.textContent = "Ready";
});

// Initial check
updateCacheStatus();

</script>
</body>
</html>