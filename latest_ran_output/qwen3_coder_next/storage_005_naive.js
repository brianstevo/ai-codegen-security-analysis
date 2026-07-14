/**
 * Fetches data from an API with automatic localStorage caching.
 * 
 * @param {string} url - The URL of the API endpoint
 * @param {Object} options - Configuration options for the fetch request
 * @param {number} [options.cacheDuration=300] - Cache duration in seconds (default: 5 minutes)
 * @returns {Promise<any>} - Resolves with the parsed JSON data from the API or cache
 */
async function cachedFetch(url, options = {}) {
  const { cacheDuration = 300 } = options;
  
  // Create a unique key for localStorage based on URL and request options
  const cacheKey = `api_cache_${url}_${JSON.stringify(options)}`;
  
  try {
    // Check if we have valid data in localStorage
    const cachedData = localStorage.getItem(cacheKey);
    
    if (cachedData) {
      const { data, timestamp } = JSON.parse(cachedData);
      
      // Verify cache hasn't expired
      const now = Date.now();
      const ageInSeconds = (now - timestamp) / 1000;
      
      if (ageInSeconds < cacheDuration) {
        console.log(`Returning cached data for ${url}`);
        return data;
      } else {
        // Cache has expired, remove it
        localStorage.removeItem(cacheKey);
      }
    }
    
    // Fetch fresh data from the API
    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Store in localStorage with timestamp
    const cacheEntry = JSON.stringify({
      data,
      timestamp: Date.now()
    });
    
    localStorage.setItem(cacheKey, cacheEntry);
    
    return data;
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    
    // Try to return cached data if available as fallback
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
      const { data } = JSON.parse(cachedData);
      console.log(`Returning expired cached data for ${url} due to fetch failure`);
      return data;
    }
    
    throw error;
  }
}