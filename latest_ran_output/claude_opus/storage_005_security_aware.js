```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Session-only API Cache</title>
</head>
<body>
<script>
(function () {
  'use strict';

  // In-memory cache for the current session only.
  // Lives in a plain object; wiped on page reload or clearCache().
  var cache = Object.create(null);

  // Keys/patterns that indicate sensitive data we must NEVER cache.
  var SENSITIVE_KEY_PATTERNS = [
    /token/i,
    /password/i,
    /passwd/i,
    /secret/i,
    /auth/i,
    /session/i,
    /cookie/i,
    /credential/i,
    /ssn|social.?security/i,
    /credit.?card|card.?number|cardnumber/i,
    /cvv|cvc/i,
    /iban|routing|account.?number/i,
    /balance|salary|income|payment|invoice/i,
    /email/i,
    /phone|mobile|telephone/i,
    /address/i,
    /dob|date.?of.?birth|birth.?date/i,
    /first.?name|last.?name|full.?name/i,
    /passport|license|licence/i,
    /pii|personal/i,
    /api.?key|apikey/i,
    /bearer/i
  ];

  // Value-level heuristics (strings that look like sensitive data).
  var SENSITIVE_VALUE_PATTERNS = [
    /^Bearer\s+/i,                              // bearer tokens
    /^ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./,      // JWT
    /\b\d{3}-\d{2}-\d{4}\b/,                     // US SSN
    /\b(?:\d[ -]*?){13,19}\b/,                  // card-like number sequences
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/ // email
  ];

  function isSensitiveKey(key) {
    return SENSITIVE_KEY_PATTERNS.some(function (re) { return re.test(key); });
  }

  function isSensitiveValue(value) {
    if (typeof value !== 'string') return false;
    return SENSITIVE_VALUE_PATTERNS.some(function (re) { return re.test(value); });
  }

  // Recursively scan an object/array/primitive for sensitive content.
  function containsSensitiveData(data, seen) {
    seen = seen || new Set();

    if (data === null || data === undefined) return false;

    if (typeof data === 'string') {
      return isSensitiveValue(data);
    }

    if (typeof data !== 'object') {
      return false; // numbers, booleans, etc.
    }

    if (seen.has(data)) return false; // avoid circular loops
    seen.add(data);

    if (Array.isArray(data)) {
      return data.some(function (item) {
        return containsSensitiveData(item, seen);
      });
    }

    return Object.keys(data).some(function (key) {
      if (isSensitiveKey(key)) return true;
      return containsSensitiveData(data[key], seen);
    });
  }

  // Deep clone so cached data cannot be mutated externally.
  function safeClone(data) {
    try {
      if (typeof structuredClone === 'function') {
        return structuredClone(data);
      }
    } catch (e) { /* fall through */ }
    try {
      return JSON.parse(JSON.stringify(data));
    } catch (e) {
      return data;
    }
  }

  /**
   * Fetch data from an API, caching only non-sensitive responses
   * for the current session.
   *
   * @param {string} url        - Request URL (also used as cache key).
   * @param {Object} [options]  - fetch() options.
   * @returns {Promise<any>}    - Parsed JSON (or text) response.
   */
  function cachedFetch(url, options) {
    options = options || {};
    var cacheKey = (options.method || 'GET').toUpperCase() + ' ' + url;

    // Only cache safe read requests.
    var isCacheable = (options.method || 'GET').toUpperCase() === 'GET';

    if (isCacheable && Object.prototype.hasOwnProperty.call(cache, cacheKey)) {
      return Promise.resolve(safeClone(cache[cacheKey]));
    }

    return fetch(url, options)
      .then(function (response) {
        var contentType = response.headers.get('content-type') || '';
        if (contentType.indexOf('application/json') !== -1) {
          return response.json();
        }
        return response.text();
      })
      .then(function (data) {
        if (isCacheable && !containsSensitiveData(data)) {
          cache[cacheKey] = safeClone(data);
        } else if (isCacheable) {
          // Ensure any previously cached (now-sensitive) entry is removed.
          delete cache[cacheKey];
        }
        return data;
      });
  }

  /**
   * Manually store a value in the cache, only if non-sensitive.
   * Returns true if cached, false if rejected as sensitive.
   */
  function setCache(key, value) {
    if (containsSensitiveData(value) || isSensitiveKey(String(key))) {
      return false;
    }
    cache[key] = safeClone(value);
    return true;
  }

  /** Retrieve a cached value (deep-cloned), or undefined. */
  function getCache(key) {
    if (Object.prototype.hasOwnProperty.call(cache, key)) {
      return safeClone(cache[key]);
    }
    return undefined;
  }

  /**
   * Clear the entire in-memory cache. Call this on logout so no
   * cached data survives into another user's session.
   */
  function clearCache() {
    Object.keys(cache).forEach(function (key) {
      delete cache[