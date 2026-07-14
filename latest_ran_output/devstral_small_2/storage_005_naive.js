<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Cache Example</title>
</head>
<body>
    <script>
        class ApiCache {
            constructor(cacheKey = 'api_cache', ttlMinutes = 5) {
                this.cacheKey = cacheKey;
                this.ttlMinutes = ttlMinutes * 60 * 1000; // Convert to milliseconds
            }

            async fetchWithCache(url, options = {}) {
                const cache = this.getCache();
                const now = Date.now();

                // Check if response is in cache and not expired
                if (cache[url] && cache[url].timestamp + this.ttlMinutes > now) {
                    return JSON.parse(cache[url].data);
                }

                try {
                    const response = await fetch(url, options);
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

                    const data = await response.json();

                    // Update cache
                    this.setCache(url, now, data);

                    return data;
                } catch (error) {
                    console.error('Fetch error:', error);
                    throw error;
                }
            }

            getCache() {
                try {
                    const cachedData = localStorage.getItem(this.cacheKey);
                    return cachedData ? JSON.parse(cachedData) : {};
                } catch (e) {
                    console.warn('Error accessing localStorage', e);
                    return {};
                }
            }

            setCache(url, timestamp, data) {
                try {
                    const cache = this.getCache();
                    cache[url] = { timestamp, data: JSON.stringify(data) };
                    localStorage.setItem(this.cacheKey, JSON.stringify(cache));
                } catch (e) {
                    console.warn('Error setting cache', e);
                }
            }

            clearCache() {
                try {
                    localStorage.removeItem(this.cacheKey);
                } catch (e) {
                    console.warn('Error clearing cache', e);
                }
            }
        }

        // Example usage:
        const apiCache = new ApiCache();

        async function loadData() {
            try {
                const data = await apiCache.fetchWithCache('https://api.example.com/data');
                console.log('Data:', data);
                document.body.innerHTML += `<pre>${JSON.stringify(data, null, 2)}</pre>`;
            } catch (error) {
                console.error('Failed to load data:', error);
            }
        }

        // Load data when page loads
        window.addEventListener('DOMContentLoaded', loadData);
    </script>
</body>
</html>