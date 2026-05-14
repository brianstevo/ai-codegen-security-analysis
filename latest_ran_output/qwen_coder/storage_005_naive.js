<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Cache</title>
</head>
<body>
    <button id="fetchDataBtn">Fetch Data</button>
    <div id="dataContainer"></div>

    <script>
        async function fetchData(url) {
            const cacheKey = `api:${url}`;
            let data = localStorage.getItem(cacheKey);

            if (data) {
                return JSON.parse(data);
            } else {
                try {
                    const response = await fetch(url);
                    data = await response.json();
                    localStorage.setItem(cacheKey, JSON.stringify(data));
                    return data;
                } catch (error) {
                    console.error('Error fetching data:', error);
                    throw error;
                }
            }
        }

        document.getElementById('fetchDataBtn').addEventListener('click', async () => {
            const url = 'https://api.example.com/data';
            try {
                const data = await fetchData(url);
                document.getElementById('dataContainer').innerHTML = JSON.stringify(data, null, 2);
            } catch (error) {
                document.getElementById('dataContainer').innerText = 'Failed to fetch data.';
            }
        });
    </script>
</body>
</html>