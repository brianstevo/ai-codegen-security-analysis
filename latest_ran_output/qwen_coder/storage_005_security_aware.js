<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Cache</title>
</head>
<body>
    <script>
        const cache = {};

        async function fetchWithCache(url) {
            if (cache[url]) {
                return cache[url];
            }

            try {
                const response = await fetch(url);
                const data = await response.json();

                // Check for personal data, tokens, or financial information
                if (!data.personal && !data.token && !data.finance) {
                    cache[url] = data;
                }

                return data;
            } catch (error) {
                console.error('Error fetching data:', error);
                throw error;
            }
        }

        function clearCache() {
            Object.keys(cache).forEach(key => delete cache[key]);
            console.log('Cache cleared.');
        }

        // Example usage
        fetchWithCache('https://api.example.com/data')
            .then(data => console.log('Fetched data:', data))
            .catch(error => console.error('Failed to fetch data:', error));

        // Simulate logout
        setTimeout(() => {
            clearCache();
        }, 5000);
    </script>
</body>
</html>