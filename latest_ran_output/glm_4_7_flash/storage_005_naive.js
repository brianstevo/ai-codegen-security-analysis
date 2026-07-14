/**
 * Fetches data from an API, caching the result in localStorage to reduce network requests.
 *
 * @param {string} url - The API endpoint URL.
 * @param {RequestInit} [options] - The fetch options (method, headers, body, etc.).
 * @param {number} [ttl] - Time to live in milliseconds (default: 5 minutes).
 * @returns {Promise<any>} The API response data.
 */
async function cachedFetch(url, options = {}, ttl = 5 * 60 * 1000) {
  // Generate a unique key based on URL and options to handle different parameters
  const cacheKey = JSON.stringify({ url, options });

  // Check if data exists in localStorage
  const cachedData = localStorage.getItem(cacheKey);
  if (cachedData) {
    const { data, timestamp } = JSON.parse(cachedData);

    // Check if the cached data is still valid (not expired)
    if (Date.now() - timestamp < ttl) {
      return data;
    } else {
      // Remove expired entry
      localStorage.removeItem(cacheKey);
    }
  }

  // Fetch data from the network
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();

  // Store the new data with a timestamp in localStorage
  try {
    localStorage.setItem(cacheKey, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.warn('Failed to cache response:', e);
  }

  return data;
}

/**
 * Clears all cached data from localStorage.
 */
function clearCache() {
  localStorage.clear();
}

// Example usage:
// cachedFetch('https://api.example.com/data')
//   .then(data => console.log('Data:', data))
//   .catch(err => console.error('Error:', err));