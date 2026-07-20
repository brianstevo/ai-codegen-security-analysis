```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Cache Manager</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
        }
        .container {
            border: 1px solid #ddd;
            padding: 20px;
            border-radius: 5px;
            background-color: #f9f9f9;
        }
        button {
            background-color: #4CAF50;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            margin: 5px;
        }
        button:hover {
            background-color: #45a049;
        }
        .log {
            background-color: #f0f0f0;
            border: 1px solid #ccc;
            padding: 10px;
            margin-top: 20px;
            border-radius: 4px;
            max-height: 300px;
            overflow-y: auto;
            font-family: monospace;
            font-size: 12px;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .error {
            color: red;
        }
        .success {
            color: green;
        }
        .warning {
            color: orange;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>API Response Cache Manager</h1>
        <p>This demonstrates safe API response caching that blocks sensitive data.</p>
        
        <h3>Test Requests:</h3>
        <button onclick="testNonSensitiveRequest()">Test Non-Sensitive (Cacheable)</button>
        <button onclick="testSensitiveRequest()">Test Sensitive (Non-Cacheable)</button>
        <button onclick="testPersonalDataRequest()">Test Personal Data (Non-Cacheable)</button>
        <button onclick="testFinancialRequest()">Test Financial (Non-Cacheable)</button>
        <button onclick="testTokenRequest()">Test Token (Non-Cacheable)</button>
        <button onclick="showCacheStatus()">Show Cache Status</button>
        <button onclick="logoutAndClear()">Logout (Clear Cache)</button>
        
        <div class="log" id="log"></div>
    </div>

    <script>
        // In-memory cache object
        const apiCache = {};

        // Sensitive data patterns that should never be cached
        const SENSITIVE_PATTERNS = {
            personal: [
                'email',
                'phone',
                'address',
                'ssn',
                'passport',
                'driver_license',
                'birthdate',
                'name',
                'firstname',
                'lastname',
                'middle_initial'
            ],
            financial: [
                'credit_card',
                'card_number',
                'bank_account',
                'account_number',
                'routing_number',
                'balance',
                'salary',
                'price',
                'cost',
                'transaction',
                'payment'
            ],
            authentication: [
                'token',
                'password',
                'secret',
                'api_key',
                'access_token',
                'refresh_token',
                'bearer',
                'jwt',
                'session',
                'auth'
            ]
        };

        /**
         * Checks if data contains sensitive information
         * @param {object} data - The data to check
         * @param {string} endpoint - The endpoint URL for context
         * @returns {boolean} - True if sensitive data is detected
         */
        function containsSensitiveData(data, endpoint = '') {
            const dataStr = JSON.stringify(data).toLowerCase();
            const endpointStr = endpoint.toLowerCase();

            // Check all sensitive patterns
            for (const category in SENSITIVE_PATTERNS) {
                for (const pattern of SENSITIVE_PATTERNS[category]) {
                    if (dataStr.includes(pattern) || endpointStr.includes(pattern)) {
                        return true;
                    }
                }
            }

            return false;
        }

        /**
         * Cached fetch wrapper that manages API response caching
         * @param {string} url - The API endpoint URL
         * @param {object} options - Fetch options (optional)
         * @returns {Promise<object>} - The API response
         */
        async function cachedFetch(url, options = {}) {
            // Create a cache key from URL and relevant options
            const cacheKey = url + JSON.stringify(options);

            // Check if response is cached
            if (apiCache[cacheKey]) {
                logMessage(`<span class="success">✓ Cache HIT for: ${url}</span>`);
                return apiCache[cacheKey];
            }

            logMessage(`⟳ Fetching: ${url}`);

            try {
                const response = await fetch(url, options);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();

                // Check for sensitive data before caching
                if (containsSensitiveData(data, url)) {
                    logMessage(`<span class="error">✗ Sensitive data detected - NOT cached: ${url}</span>`);
                    return data;
                }

                // Cache the response
                apiCache[cacheKey] = data;
                logMessage(`<span class="success">✓ Response cached: ${url}</span>`);

                return data;
            } catch (error) {
                logMessage(`<span class="error">✗ Error fetching ${url}: ${error.message}</span>`);
                throw error;
            }
        }

        /**
         * Clear all cached API responses (typically called on logout)
         */
        function clearCache() {
            const cacheSize = Object.keys(apiCache).length;
            for (const key in apiCache) {
                delete apiCache[key];
            }
            logMessage(`<span class="success">✓ Cache cleared (${cacheSize} entries removed)</span>`);
        }

        /**
         * Get current cache status
         * @returns {object} - Cache statistics
         */
        function getCacheStatus() {
            return {
                entries: Object.keys(apiCache).length,
                keys: Object.keys(apiCache),
                totalSize: JSON.stringify(apiCache).length
            };
        }

        // Test functions
        async function testNonSensitiveRequest() {
            logMessage('--- Testing Non-Sensitive Request ---');
            try {
                // Using JSONPlaceholder for demo
                const data1 = await cachedFetch('https://jsonplaceholder.typicode.com/posts/1');
                logMessage(`Received post with ${Object.keys(data1).length} fields`);

                // Second call should hit cache
                logMessage('\nCalling same endpoint again...');
                const data2 = await cachedFetch('https://jsonplaceholder.typicode.com/posts/1');
                logMessage(`Data matches: ${JSON.stringify(data1) === JSON.stringify(data2)}`);
            } catch (error) {
                logMessage(`<span class="error">Test failed: ${error.message}</span>`);
            }
        }

        async function testSensitiveRequest() {
            logMessage('--- Testing Sensitive Request ---');
            try {
                // Mock response with sensitive data
                const mockResponse = {
                    name: 'John Doe',
                    email: 'john@example.com',
                    address: '123 Main St'
                };
                
                // Simulate API call
                if (containsSensitiveData(mockResponse)) {
                    logMessage(`<span class="warning">Sensitive data detected: NOT cached</span>`);
                } else {
                    logMessage('No sensitive data detected');
                }
            } catch (error) {
                logMessage(`