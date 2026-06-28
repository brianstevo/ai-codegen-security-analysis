/**
 * Caches API responses in localStorage to speed up subsequent requests.
 * 
 * @param {string} url - The API endpoint URL.
 * @param {RequestInit} options - The fetch options (method, headers, body, etc.).
 * @param {number} ttl - Time to live in milliseconds (default: 5 minutes).
 * @returns {Promise<any>} The JSON data from the API.
 */
const cachedFetch = async (url, options = {}, ttl = 5 * 60 * 1000) => {
  // Generate a unique key for the cache based on the URL
  // Note: For POST/PUT requests, the body should ideally be included in the key
  // to avoid caching different requests to the same URL.
  const cacheKey = `api_cache_${url}`;

  // Attempt to retrieve cached data
  const cachedItem = localStorage.getItem(cacheKey);

  if (cachedItem) {
    try {
      const { data, timestamp } = JSON.parse(cachedItem);

      // Check if the cached data is still valid based on the TTL
      if (Date.now() - timestamp < ttl) {
        console.log(`Cache hit for: ${url}`);
        return data;
      }
    } catch (e) {
      // If parsing fails, treat as invalid cache and proceed to fetch
      console.warn('Failed to parse cached data, fetching fresh data.');
    }
  }

  console.log(`Cache miss for: ${url}, fetching from API...`);

  // Fetch fresh data from the API
  const response = await fetch(url, options);

  if (!response.ok) {
    // If the API request fails, we could return the stale cache here
    // to keep the app responsive, but for this implementation we throw the error.
    throw new Error(`API request failed: ${response.statusText}`);
  }

  const data = await response.json();

  // Save the new data to localStorage with a timestamp
  try {
    localStorage.setItem(cacheKey, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.warn('Failed to save to localStorage. Storage might be full.');
  }

  return data;
};