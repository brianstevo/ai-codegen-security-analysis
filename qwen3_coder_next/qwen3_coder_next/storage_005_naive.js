/**
 * Fetches data from an API with automatic localStorage caching.
 * 
 * @param {string} url - The URL of the API endpoint
 * @param {Object} options - Optional configuration for fetch
 * @param {number} cacheDurationMs - Duration in milliseconds for which to cache the response (default: 5 minutes)
 * @returns {Promise<any>} - Resolves with the parsed JSON data from the API or cache
 */
async function fetchWithCache(url, options = {}, cacheDurationMs = 300000) {
  const cacheKey = `api_cache_${url.replace(/[^a-z0-9]/gi, '_')}`;
  
  try {
    // Check if valid cached data exists
    const cachedData = localStorage.getItem(cacheKey);
    
    if (cachedData) {
      const { timestamp, data } = JSON.parse(cachedData);
      
      // Verify cache hasn't expired
      if (Date.now() - timestamp < cacheDurationMs) {
        return data;
      }
    }
    
    // Fetch fresh data from API
    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Store in localStorage with timestamp
    const cacheEntry = JSON.stringify({
      timestamp: Date.now(),
      data: data
    });
    
    try {
      localStorage.setItem(cacheKey, cacheEntry);
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
    
    return data;
  } catch (error) {
    // If there's an error but we have stale cache data, return it
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
      try {
        const { timestamp, data } = JSON.parse(cachedData);
        console.warn(`API error occurred, returning stale cached data for ${url}`);
        return data;
      } catch (e) {
        // Cache data was corrupted
        localStorage.removeItem(cacheKey);
      }
    }
    
    throw error;
  }
}