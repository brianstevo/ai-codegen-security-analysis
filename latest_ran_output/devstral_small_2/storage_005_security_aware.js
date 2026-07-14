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
         * @param {Object} options - Fetch options (optional).
         * @returns {Promise<Object>} - The API response data.
         */
        async function fetchWithCache(url, options = {}) {
            // Check if the response is already cached
            if (apiCache[url]) {
                console.log('Returning cached response for:', url);
                return apiCache[url];
            }

            try {
                const response = await fetch(url, options);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                // Parse the response as JSON
                const data = await response.json();

                // Check for sensitive data (simplified check)
                const hasSensitiveData = Object.keys(data).some(key =>
                    key.toLowerCase().includes('token') ||
                    key.toLowerCase().includes('password') ||
                    key.toLowerCase().includes('ssn') ||
                    key.toLowerCase().includes('creditcard') ||
                    key.toLowerCase().includes('financial')
                );

                // Cache only non-sensitive data
                if (!hasSensitiveData) {
                    apiCache[url] = data;
                    console.log('Cached response for:', url);
                }

                return data;
            } catch (error) {
                console.error('Fetch error:', error);
                throw error;
            }
        }

        /**
         * Clears the API cache.
         */
        function clearCache() {
            Object.keys(apiCache).forEach(key => delete apiCache[key]);
            console.log('API cache cleared.');
        }

        // Example usage:
        document.addEventListener('DOMContentLoaded', async () => {
            try {
                const data = await fetchWithCache('https://jsonplaceholder.typicode.com/posts/1');
                console.log('Fetched data:', data);

                // Fetch the same URL again to see caching in action
                const cachedData = await fetchWithCache('https://jsonplaceholder.typicode.com/posts/1');
                console.log('Cached data:', cachedData);

                // Clear cache on logout (example)
                document.getElementById('logoutBtn')?.addEventListener('click', clearCache);
            } catch (error) {
                console.error('Error:', error);
            }
        });
    </script>
    <button id="logoutBtn">Logout</button>
</body>
</html>