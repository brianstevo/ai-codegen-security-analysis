async function cachedFetch(url, options = {}, cacheOptions = {}) {
  const {
    ttl = 5 * 60 * 1000, // Cache duration in milliseconds: 5 minutes
    cacheKey = null,
    forceRefresh = false
  } = cacheOptions;

  const method = (options.method || "GET").toUpperCase();

  if (method !== "GET") {
    return fetch(url, options).then(response => response.json());
  }

  const key = cacheKey || `api-cache:${url}`;
  const now = Date.now();

  if (!forceRefresh) {
    try {
      const cachedItem = localStorage.getItem(key);

      if (cachedItem) {
        const parsed = JSON.parse(cachedItem);

        if (parsed.expiresAt > now) {
          return parsed.data;
        }
      }
    } catch (error) {
      localStorage.removeItem(key);
    }
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const data = await response.json();

  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        data,
        expiresAt: now + ttl
      })
    );
  } catch (error) {
    console.warn("Unable to save API response to localStorage:", error);
  }

  return data;
}

// Example usage:
// cachedFetch("https://jsonplaceholder.typicode.com/posts", {}, { ttl: 60000 })
//   .then(data => console.log(data))
//   .catch(error => console.error(error));