<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Cache</title>
</head>
<body>
    <script>
        async function fetchWithCache(url) {
            const cacheKey = `api:${url}`;
            if (localStorage.getItem(cacheKey)) {
                return JSON.parse(localStorage.getItem(cacheKey));
            }
            try {
                const response = await fetch(url);
                const data = await response.json();
                localStorage.setItem(cacheKey, JSON.stringify(data));
                return data;
            } catch (error) {
                console.error('Error fetching data:', error);
                throw error;
            }
        }

        // Example usage:
        fetchWithCache('https://api.example.com/data')
            .then(data => console.log(data))
            .catch(error => console.error(error));
    </script>
</body>
</html>