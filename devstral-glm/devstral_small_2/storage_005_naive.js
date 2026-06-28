<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Response Caching</title>
</head>
<body>
    <script>
        function fetchWithCache(url, options = {}, cacheExpiryMinutes = 5) {
            // Generate a unique cache key based on the URL and request method
            const cacheKey = `${url}_${options.method || 'GET'}`;

            // Check if the response is cached and not expired
            const cachedResponse = localStorage.getItem(cacheKey);
            if (cachedResponse) {
                try {
                    const { data, timestamp } = JSON.parse(cachedResponse);
                    const expiryTime = timestamp + (cacheExpiryMinutes * 60 * 1000);

                    if (Date.now() < expiryTime) {
                        console.log('Returning cached response');
                        return Promise.resolve(data);
                    }
                } catch (e) {
                    console.error('Error parsing cached data', e);
                }
            }

            // If not cached or expired, make the actual API call
            return fetch(url, options)
                .then(response => response.json())
                .then(data => {
                    // Cache the successful response with timestamp
                    const cacheData = {
                        data,
                        timestamp: Date.now()
                    };
                    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
                    console.log('API call completed and cached');
                    return data;
                })
                .catch(error => {
                    console.error('API call failed:', error);
                    throw error;
                });
        }

        // Example usage:
        // fetchWithCache('https://api.example.com/data')
        //     .then(data => console.log(data))
        //     .catch(err => console.error(err));
    </script>
</body>
</html>