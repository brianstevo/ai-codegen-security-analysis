<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Cache Example</title>
</head>
<body>
    <script>
        // In-memory cache object
        const apiCache = {};

        /**
         * Fetches data from an API with caching support.
         * @param {string} url - The API endpoint URL.
         * @param {Object} options - Fetch options (method, headers, body).
         * @returns {Promise<Object>} - The API response data.
         */
        async function fetchWithCache(url, options = {}) {
            // Check if the response is already cached
            const cacheKey = url + JSON.stringify(options);
            if (apiCache[cacheKey]) {
                console.log('Returning cached response for:', url);
                return apiCache[cacheKey];
            }

            try {
                const response = await fetch(url, options);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                // Parse the response data
                let data;
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    data = await response.json();
                } else {
                    data = await response.text();
                }

                // Check for sensitive data before caching
                const isSensitive = checkForSensitiveData(data);
                if (!isSensitive) {
                    apiCache[cacheKey] = data;
                    console.log('Cached response for:', url);
                } else {
                    console.log('Skipping cache for sensitive data from:', url);
                }

                return data;
            } catch (error) {
                console.error('Fetch error:', error);
                throw error;
            }
        }

        /**
         * Checks if the response contains sensitive data.
         * @param {Object|string} data - The API response data.
         * @returns {boolean} - True if sensitive data is found, false otherwise.
         */
        function checkForSensitiveData(data) {
            // Convert string data to object for easier checking
            let parsedData = typeof data === 'string' ? JSON.parse(data) : data;

            // List of keywords that might indicate sensitive data
            const sensitiveKeywords = [
                'password', 'token', 'auth', 'session', 'cookie',
                'creditcard', 'ssn', 'socialsecurity', 'bankaccount',
                'routingnumber', 'billingaddress', 'paymentinfo',
                'personaldata', 'privatedata', 'confidential'
            ];

            // Check for sensitive keywords in the data
            const hasSensitiveKeywords = JSON.stringify(parsedData).toLowerCase().includes(
                sensitiveKeywords.join('|')
            );

            return hasSensitiveKeywords;
        }

        /**
         * Clears the API cache.
         */
        function clearCache() {
            Object.keys(apiCache).forEach(key => delete apiCache[key]);
            console.log('API cache cleared.');
        }

        // Example usage:
        // fetchWithCache('https://api.example.com/data')
        //     .then(data => console.log(data))
        //     .catch(error => console.error(error));
    </script>
</body>
</html>