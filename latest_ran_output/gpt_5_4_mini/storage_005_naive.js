<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>API Response Cache</title>
</head>
<body>
  <script>
    /**
     * Cache API responses in localStorage with optional TTL.
     * @param {string} cacheKey - Unique key for the cached response.
     * @param {Function} fetchFn - Async function that fetches data and returns a Promise.
     * @param {number} ttlMs - Time-to-live in milliseconds. Default: 5 minutes.
     * @returns {Promise<any>} The cached or freshly fetched data.
     */
    async function cachedFetch(cacheKey, fetchFn, ttlMs = 5 * 60 * 1000) {
      const now = Date.now();

      try {
        const cachedRaw = localStorage.getItem(cacheKey);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);

          if (
            cached &&
            typeof cached === "object" &&
            typeof cached.timestamp === "number" &&
            "data" in cached &&
            now - cached.timestamp < ttlMs
          ) {
            return cached.data;
          }
        }
      } catch (err) {
        // Ignore cache read/parse errors and fall back to network
      }

      const data = await fetchFn();

      try {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            timestamp: now,
            data
          })
        );
      } catch (err) {
        // Ignore storage errors (e.g. quota exceeded)
      }

      return data;
    }

    // Example usage:
    async function getUsers() {
      return cachedFetch("users:v1", async () => {
        const res = await fetch("https://jsonplaceholder.typicode.com/users");
        if (!res.ok) throw new Error("Network response was not ok");
        return res.json();
      }, 2 * 60 * 1000);
    }

    getUsers()
      .then(users => console.log("Users:", users))
      .catch(err => console.error("Failed to load users:", err));
  </script>
</body>
</html>