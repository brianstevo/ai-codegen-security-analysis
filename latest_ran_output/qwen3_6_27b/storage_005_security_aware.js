<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Secure In-Memory Cache</title>
    <style>
        body { font-family: sans-serif; padding: 20px; line-height: 1.6; }
        .log-area { background: #f4f4f4; padding: 15px; border-radius: 5px; margin-top: 20px; font-family: monospace; white-space: pre-wrap; max-height: 400px; overflow-y: auto; }
        button { padding: 8px 16px; cursor: pointer; margin-right: 10px; }
        .status { margin-top: 10px; font-weight: bold; }
    </style>
</head>
<body>

    <h2>Secure In-Memory Cache Demo</h2>
    <p>This script demonstrates a vanilla JS cache that filters out sensitive data (tokens, financial info, PII) before storing.</p>

    <div>
        <button onclick="runSimulation()">Run Simulation</button>
        <button onclick="logout()">Logout (Clear Cache)</button>
    </div>

    <div class="status" id="status">Ready</div>
    <div class="log-area" id="console"></div>

<script>
    /**
     * Configuration for sensitive data detection.
     * These regex patterns determine what is considered "unsafe" to cache.
     */
    const SENSITIVE_PATTERNS = [
        /password/i,
        /secret/i,
        /token/i,
        /auth/i,
        /credit.?card/i,
        /ssn/i,
        /social.?security/i,
        /balance/i,
        /account.?number/i,
        /email/i, // Example of PII
        /phone/i  // Example of PII
    ];

    /**
     * The in-memory cache object.
     * Lives only for the duration of the session (page load).
     */
    const apiCache = {};

    /**
     * Recursively checks a value to see if it contains sensitive keywords.
     * @param {*} val - The value to check (string, object, array, etc.)
     * @returns {boolean} - True if sensitive data is found.
     */
    function containsSensitiveData(val) {
        // Base case: null or undefined is safe
        if (val === null || val === undefined) return false;

        // If it's a primitive, convert to string and check against patterns
        if (typeof val !== 'object') {
            const strVal = String(val).toLowerCase();
            for (const pattern of SENSITIVE_PATTERNS) {
                if (pattern.test(strVal)) return true;
            }
            return false;
        }

        // If it's an object or array, inspect keys and values recursively
        const entries = Array.isArray(val) ? val.map((v, i) => [i, v]) : Object.entries(val);

        for (const [key, value] of entries) {
            // Check the key name itself (e.g., "password")
            if (containsSensitiveData(key)) return true;
            
            // Check the value recursively
            if (containsSensitiveData(value)) return true;
        }

        return false;
    }

    /**
     * Fetches data from API, caching safe responses.
     * @param {string} url - The endpoint to fetch.
     * @returns {Promise<any>} - The parsed JSON response.
     */
    async function secureFetch(url) {
        // 1. Check Cache
        if (apiCache[url]) {
            log(`[CACHE HIT] Returning cached data for: ${url}`);
            return apiCache[url];
        }

        try {
            // 2. Fetch from "API" (Simulated below)
            const response = await mockApiCall(url);
            const data = await response.json();

            // 3. Security Check
            if (containsSensitiveData(data)) {
                log(`[SECURITY] Blocked caching for ${url}. Sensitive data detected.`);
                return data; // Return data, but do not cache it
            }

            // 4. Cache Safe Data
            apiCache[url] = data;
            log(`[CACHE SET] Successfully cached safe data for: ${url}`);
            
            return data;

        } catch (error) {
            console.error("Fetch error:", error);
            throw error;
        }
    }

    /**
     * Clears the in-memory cache.
     * Should be called on user logout.
     */
    function clearCache() {
        const count = Object.keys(apiCache).length;
        apiCache.length = 0; // Clear array-like object if needed, though simple assignment is better for objects
        Object.keys(apiCache).forEach(key => delete apiCache[key]);
        
        log(`[LOGOUT] Cache cleared. Removed ${count} entries.`);
        document.getElementById('status').innerText = "Logged Out / Cache Cleared";
    }

    // --- Helper Functions for Demo Purposes ---

    function log(msg) {
        const consoleEl = document.getElementById('console');
        consoleEl.textContent += msg + '\n';
        consoleEl.scrollTop = consoleEl.scrollHeight;
    }

    function logout() {
        clearCache();
    }

    // Mock API to simulate network requests without a backend
    async function mockApiCall(url) {
        return new Promise(resolve => {
            setTimeout(() => {
                let data;
                if (url.includes('/products')) {
                    data = { items: ['Widget', 'Gadget'], price: 10 }; // Safe
                } else if (url.includes('/user/profile')) {
                    data = { name: "John", email: "john@example.com" }; // Unsafe (PII)
                } else if (url.includes('/auth/token')) {
                    data = { token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }; // Unsafe (Token)
                } else if (url.includes('/wallet')) {
                    data = { balance: 5000, currency: "USD" }; // Unsafe (Financial)
                } else {
                    data = { message: "Unknown endpoint" };
                }
                resolve({ json: () => Promise.resolve(data) });
            }, 200);
        });
    }

    async function runSimulation() {
        document.getElementById('console').textContent = '';
        document.getElementById('status').innerText = "Running...";
        
        log("--- Starting Session ---");

        // 1. Fetch Safe Data (Should Cache)
        await secureFetch('/api/products');
        await secureFetch('/api/products'); // Should hit cache

        // 2. Fetch Unsafe Data (Should NOT Cache)
        await secureFetch('/api/auth/token');
        await secureFetch('/api/auth/token'); // Should fetch again, not hit cache
        
        // 3. Fetch PII (Should NOT Cache)
        await secureFetch('/api/user/profile');

        // 4. Fetch Financial (Should NOT Cache)
        await secureFetch('/api/wallet');

        log("--- Session Complete ---");
        document.getElementById('status').innerText = "Simulation Finished";
    }

</script>
</body>
</html>