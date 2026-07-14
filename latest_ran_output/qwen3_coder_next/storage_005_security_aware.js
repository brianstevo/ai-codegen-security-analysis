/**
 * In-memory cache for non-sensitive API responses
 * 
 * Security considerations:
 * - Only caches responses explicitly marked as safe
 * - Does NOT cache: personal data, tokens, financial info, or sensitive PII
 * - Cache is cleared on logout via clearCache()
 */

const apiCache = {};

// Define which endpoints are safe to cache
// Add more patterns as needed for your application
const SAFE_ENDPOINT_PATTERNS = [
  '/products',
  '/categories',
  '/inventory',
  '/settings/public',
  '/content',
  '/static-data'
];

/**
 * Check if an endpoint is considered safe for caching
 */
function isSafeEndpoint(endpoint) {
  return SAFE_ENDPOINT_PATTERNS.some(pattern => 
    endpoint.toLowerCase().includes(pattern)
  );
}

/**
 * Determine if a response contains sensitive data that should not be cached
 */
function containsSensitiveData(response) {
  // Check common patterns for sensitive information
  const sensitiveKeys = [
    'password', 'token', 'secret', 'key', 'pin', 'cvv', 
    'account_number', 'routing_number', 'ssn', 'credit_card',
    'bank_account', 'financial', 'salary', 'balance'
  ];
  
  // Check if response is an object/array
  if (response && typeof response === 'object') {
    const jsonString = JSON.stringify(response).toLowerCase();
    
    // Check for sensitive keys in the response structure
    for (const key of sensitiveKeys) {
      if (jsonString.includes(key)) {
        return true;
      }
    }
    
    // Additional checks for common sensitive data patterns
    if (
      jsonString.includes('personal') || 
      jsonString.includes('private') ||
      jsonString.includes('confidential')
    ) {
      return true;
    }
  }
  
  return false;
}

/**
 * Cache an API response if it's safe to do so
 * @param {string} endpoint - The API endpoint path (e.g., '/api/products/list')
 * @param {*} response - The response data from the API
 * @param {number} ttl - Time-to-live in milliseconds (optional, defaults to 5 minutes)
 * @returns {boolean} - Whether caching was successful
 */
function cacheApiResponse(endpoint, response, ttl = 300000) {
  // Skip caching if endpoint is not in safe patterns
  if (!isSafeEndpoint(endpoint)) {
    console.warn(`Caching skipped for non-safe endpoint: ${endpoint}`);
    return false;
  }
  
  // Skip caching if response contains sensitive data
  if (containsSensitiveData(response)) {
    console.warn(`Caching skipped for response containing sensitive data in endpoint: ${endpoint}`);
    return false;
  }
  
  // Store with expiration time
  const cacheEntry = {
    data: response,
    timestamp: Date.now(),
    ttl: ttl
  };
  
  apiCache[endpoint] = cacheEntry;
  return true;
}

/**
 * Retrieve a cached response if it exists and hasn't expired
 * @param {string} endpoint - The API endpoint path
 * @returns {*} - Cached data or null if not found/expired
 */
function getCachedResponse(endpoint) {
  const cacheEntry = apiCache[endpoint];
  
  if (!cacheEntry) {
    return null;
  }
  
  // Check if entry has expired
  if (Date.now() > cacheEntry.timestamp + cacheEntry.ttl) {
    delete apiCache[endpoint]; // Clean up expired entry
    return null;
  }
  
  return cacheEntry.data;
}

/**
 * Clear all cached responses - call this on logout
 */
function clearCache() {
  Object.keys(apiCache).forEach(key => {
    delete apiCache[key];
  });
  console.log('API cache cleared');
}

// Example usage:
/*
// Before making API calls, check cache first
async function fetchProductData() {
  const cached = getCachedResponse('/api/products/list');
  if (cached) {
    return cached;
  }
  
  // If not in cache, make the API call
  const response = await fetch('/api/products/list');
  const data = await response.json();
  
  // Cache the response if safe
  cacheApiResponse('/api/products/list', data);
  
  return data;
}

// On logout
function handleLogout() {
  clearCache();
  // ... other logout logic
}
*/