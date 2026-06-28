/**
 * In-memory cache for non-sensitive API responses
 * 
 * Security considerations:
 * - Only caches responses explicitly marked as safe
 * - Does NOT cache: personal data, tokens, financial info, or sensitive PII
 * - Cache is cleared on logout via clearCache()
 */

// Internal cache storage (in-memory object)
let apiCache = {};

/**
 * Configuration for allowed endpoints and their cache duration
 * Key: API endpoint path (e.g., '/api/products')
 * Value: { ttl: milliseconds, safe: true }
 */
const cacheConfig = {
  // Example safe endpoints
  '/api/products': { ttl: 60000, safe: true },    // 1 minute TTL
  '/api/categories': { ttl: 300000, safe: true }, // 5 minutes TTL
  '/api/inventory-status': { ttl: 120000, safe: true } // 2 minutes TTL
};

/**
 * Check if a response contains sensitive data that should never be cached
 */
function containsSensitiveData(data) {
  if (!data || typeof data !== 'object') return false;
  
  const sensitivePatterns = [
    /password|token|secret|key|api[_-]?key/i,
    /credit[_-]?card|cvv|expiry|billing|payment/,
    /ssn|social[_-]?security|national[_-]?id|passport/,
    /address[_-]?line|street[_-]?name|zip[_-]?code|postal[_-]?code/i,
    /phone|mobile|email|contact[_-]?info/i,
    /income|salary|wage|payment[_-]?amount|balance|account[_-]?number/i
  ];
  
  const checkValue = (value) => {
    if (!value || typeof value !== 'object') return false;
    
    // Check object keys for sensitive patterns
    Object.keys(value).forEach(key => {
      sensitivePatterns.forEach(pattern => {
        if (pattern.test(key)) throw new Error('Sensitive data detected');
      });
      
      // Recursively check nested objects/arrays
      if (typeof value[key] === 'object' && value[key] !== null) {
        checkValue(value[key]);
      }
    });
    
    return false;
  };
  
  try {
    checkValue(data);
    return false;
  } catch (e) {
    return true;
  }
}

/**
 * Check if endpoint is configured for caching
 */
function isCacheableEndpoint(endpoint) {
  // Normalize endpoint path
  const normalizedEndpoint = endpoint.replace(/\/+$/, ''); // Remove trailing slashes
  
  // Check exact match or prefix match
  return Object.keys(cacheConfig).some(key => {
    const normalizedKey = key.replace(/\/+$/, '');
    return normalizedEndpoint === normalizedKey || 
           normalizedEndpoint.startsWith(normalizedKey + '/');
  });
}

/**
 * Get cache entry for an endpoint
 */
function getFromCache(endpoint) {
  if (!apiCache[endpoint]) return null;
  
  const cachedEntry = apiCache[endpoint];
  const now = Date.now();
  
  // Check if entry has expired
  if (now > cachedEntry.expiryTime) {
    delete apiCache[endpoint];
    return null;
  }
  
  return cachedEntry.data;
}

/**
 * Store response in cache
 */
function setInCache(endpoint, data, ttl) {
  try {
    // Validate that data is safe to cache
    if (containsSensitiveData(data)) {
      console.warn(`Refusing to cache sensitive data for endpoint: ${endpoint}`);
      return false;
    }
    
    apiCache[endpoint] = {
      data: data,
      expiryTime: Date.now() + ttl,
      createdAt: Date.now()
    };
    
    // Optional: Log cache operations in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`Cached response for ${endpoint} (expires in ${ttl}ms)`);
    }
    
    return true;
  } catch (error) {
    console.error('Error caching data:', error);
    return false;
  }
}

/**
 * Main function to fetch and cache API responses
 */
async function cachedFetch(endpoint, options = {}) {
  // Check if endpoint is configured for caching
  if (!isCacheableEndpoint(endpoint)) {
    console.warn(`Endpoint ${endpoint} is not configured for caching`);
    return fetch(endpoint, options);
  }
  
  const config = Object.keys(cacheConfig).find(key => 
    endpoint === key.replace(/\/+$/, '') || 
    endpoint.startsWith(key.replace(/\/+$/, '') + '/')
  );
  
  if (!config) {
    console.warn(`No cache configuration found for ${endpoint}`);
    return fetch(endpoint, options);
  }
  
  const ttl = cacheConfig[config].ttl;
  
  // Check cache first
  const cachedData = getFromCache(endpoint);
  if (cachedData !== null) {
    console.log(`Cache hit for ${endpoint}`);
    
    // Return a mock response object that matches fetch API
    return {
      ok: true,
      status: 200,
      json: async () => cachedData,
      text: async () => JSON.stringify(cachedData)
    };
  }
  
  console.log(`Cache miss for ${endpoint}, fetching from network`);
  
  try {
    const response = await fetch(endpoint, options);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Only cache successful responses
    if (data && typeof data === 'object') {
      setInCache(endpoint, data, ttl);
    }
    
    return response;
  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error);
    throw error;
  }
}

/**
 * Clear all cached data (call on logout)
 */
function clearCache() {
  apiCache = {};
  
  // Optional: Log cache clearing in development
  if (process.env.NODE_ENV === 'development') {
    console.log('Cache cleared');
  }
}

// Export functions for use in application
// In a real application, you might attach these to a module or global object
if (typeof window !== 'undefined') {
  window.apiCache = {
    cachedFetch,
    clearCache,
    getFromCache,
    setInCache,
    containsSensitiveData,
    cacheConfig
  };
}