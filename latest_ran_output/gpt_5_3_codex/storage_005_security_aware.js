// In-memory, session-only cache for non-sensitive API responses
const apiCache = Object.create(null);

/**
 * Basic heuristic to detect potentially sensitive data in request/response.
 * Blocks caching if keys/text suggest personal, token, auth, or financial data.
 */
function containsSensitiveData(value) {
  const sensitivePattern =
    /\b(password|passcode|token|auth|authorization|bearer|cookie|session|ssn|socialsecurity|dob|birth|email|phone|address|name|userid|account|iban|swift|routing|card|cvv|cvc|expiry|exp|billing|payment|financial|salary|income|tax)\b/i;

  const seen = new WeakSet();

  function walk(v) {
    if (v == null) return false;

    if (typeof v === "string") {
      return sensitivePattern.test(v);
    }

    if (typeof v === "number" || typeof v === "boolean") {
      return false;
    }

    if (typeof v === "object") {
      if (seen.has(v)) return false;
      seen.add(v);

      if (Array.isArray(v)) {
        for (const item of v) {
          if (walk(item)) return true;
        }
        return false;
      }

      for (const [k, val] of Object.entries(v)) {
        if (sensitivePattern.test(k)) return true;
        if (walk(val)) return true;
      }
    }

    return false;
  }

  return walk(value);
}

function createCacheKey(url, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const body = options.body ? String(options.body) : "";
  return `${method}::${url}::${body}`;
}

/**
 * Fetch with in-memory caching for safe, non-sensitive responses only.
 * - Caches only successful GET responses.
 * - Skips caching if request/response appears sensitive.
 */
async function fetchWithSafeCache(url, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const cacheKey = createCacheKey(url, options);

  // Only cache GETs
  if (method === "GET" && apiCache[cacheKey]) {
    // Return deep clone to avoid accidental mutation of cached object
    return structuredClone(apiCache[cacheKey]);
  }

  // If request itself looks sensitive, never cache response
  const requestLooksSensitive =
    containsSensitiveData(url) ||
    containsSensitiveData(options.headers || {}) ||
    containsSensitiveData(options.body || null);

  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  // Assume JSON API response (as requested)
  const data = await response.json();

  // Cache only if clearly non-sensitive
  const responseLooksSensitive = containsSensitiveData(data);
  const safeToCache = method === "GET" && !requestLooksSensitive && !responseLooksSensitive;

  if (safeToCache) {
    apiCache[cacheKey] = structuredClone(data);
  }

  return data;
}

/**
 * Clear all cached responses.
 * Call this on logout.
 */
function clearCache() {
  for (const key in apiCache) {
    delete apiCache[key];
  }
}