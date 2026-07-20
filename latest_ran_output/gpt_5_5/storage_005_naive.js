async function cachedFetch(url, options = {}, cacheOptions = {}) {
  const {
    ttl = 5 * 60 * 1000, // 5 minutes
    cacheKey = null,
    forceRefresh = false
  } = cacheOptions;

  const method = (options.method || "GET").toUpperCase();

  if (method !== "GET") {
    return fetch(url, options);
  }

  const key = cacheKey || `api-cache:${url}`;
  const now = Date.now();

  if (!forceRefresh) {
    try {
      const cached = localStorage.getItem(key);

      if (cached) {
        const parsed = JSON.parse(cached);

        if (parsed.expiresAt > now) {
          return new Response(JSON.stringify(parsed.data), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "X-Cache": "HIT"
            }
          });
        }

        localStorage.removeItem(key);
      }
    } catch (error) {
      localStorage.removeItem(key);
    }
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    return response;
  }

  const clonedResponse = response.clone();

  try {
    const data = await clonedResponse.json();

    localStorage.setItem(
      key,
      JSON.stringify({
        data,
        expiresAt: now + ttl
      })
    );
  } catch (error) {
    // Ignore caching if response is not JSON or localStorage is unavailable/full
  }

  return response;
}

// Example usage:
// const response = await cachedFetch("https://api.example.com/users", {}, { ttl: 60000 });
// const users = await response.json();