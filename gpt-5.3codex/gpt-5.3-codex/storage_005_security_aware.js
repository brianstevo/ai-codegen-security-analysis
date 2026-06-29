/**
 * In-memory API response cache for the current page session.
 * - Uses a plain object as cache storage.
 * - Skips caching responses that appear sensitive.
 * - Exposes clearCache() for logout/session end.
 */

const apiResponseCache = Object.create(null);

// Heuristic patterns to detect sensitive content/keys
const SENSITIVE_KEY_PATTERN =
  /(password|passcode|token|access[_-]?token|refresh[_-]?token|secret|ssn|social[_-]?security|credit[_-]?card|card[_-]?number|cvv|cvc|iban|account[_-]?number|routing|dob|date[_-]?of[_-]?birth|email|phone|address|full[_-]?name|firstname|lastname|surname|personal)/i;

const SENSITIVE_VALUE_PATTERN =
  /\b(bearer\s+[a-z0-9\-._~+/]+=*|[0-9]{13,19}|[0-9]{3}-[0-9]{2}-[0-9]{4}|[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30})\b/i;

/**
 * Deep scan to detect potentially sensitive data.
 * Returns true if sensitive data is found.
 */
function containsSensitiveData(value) {
  if (value == null) return false;

  if (typeof value === "string") {
    return SENSITIVE_VALUE_PATTERN.test(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return false;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      if (containsSensitiveData(item)) return true;
    }
    return false;
  }

  if (typeof value === "object") {
    for (const [key, val] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) return true;
      if (containsSensitiveData(val)) return true;
    }
  }

  return false;
}

/**
 * Stable cache key creator (method + URL + optional body/query context)
 */
function buildCacheKey({ method = "GET", url, keyData = null }) {
  const m = String(method).toUpperCase();
  const u = String(url);
  let extra = "";

  if (keyData !== null && keyData !== undefined) {
    try {
      extra = JSON.stringify(keyData, Object.keys(keyData).sort());
    } catch {
      extra = String(keyData);
    }
  }

  return `${m}::${u}::${extra}`;
}

/**
 * Cache-safe fetch wrapper.
 * Caches only successful, non-sensitive JSON responses in-memory.
 */
async function fetchWithSessionCache(url, options = {}) {
  const method = (options.method || "GET").toUpperCase();

  // Only cache idempotent reads by default
  const cacheableMethod = method === "GET" || method === "HEAD";
  const keyData = options.cacheKeyData || null;
  const cacheKey = buildCacheKey({ method, url, keyData });

  if (cacheableMethod && apiResponseCache[cacheKey]) {
    // Return a cloned copy to avoid accidental mutation of cache
    return structuredClone(apiResponseCache[cacheKey]);
  }

  const res = await fetch(url, options);

  // If not OK, don't cache
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }

  // Try JSON first; if not JSON, don't cache
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return res.text();
  }

  const data = await res.json();

  // Only cache if safe and method cacheable
  if (cacheableMethod && !containsSensitiveData(data)) {
    apiResponseCache[cacheKey] = structuredClone(data);
  }

  return data;
}

/**
 * Clears all in-memory cached API responses.
 * Call this on logout.
 */
function clearCache() {
  for (const key in apiResponseCache) {
    if (Object.prototype.hasOwnProperty.call(apiResponseCache, key)) {
      delete apiResponseCache[key];
    }
  }
}

// Example:
// const products = await fetchWithSessionCache("/api/products");
// clearCache(); // call on logout