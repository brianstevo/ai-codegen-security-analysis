```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Session API Cache</title>
</head>
<body>
<script>
(function () {
  'use strict';

  // In-memory cache for the current session only.
  // Lives in a plain object; cleared on clearCache() / logout / page unload.
  let cache = Object.create(null);

  // Patterns that indicate a response likely contains personal data,
  // authentication tokens, or financial information. Such responses are
  // never cached.
  const SENSITIVE_KEY_PATTERNS = [
    // Authentication / tokens
    /token/i, /auth/i, /secret/i, /password/i, /passwd/i, /pwd/i,
    /apikey/i, /api_key/i, /credential/i, /session/i, /jwt/i,
    /refresh[_-]?token/i, /access[_-]?token/i, /bearer/i,
    // Personal data
    /ssn/i, /social[_-]?security/i, /passport/i, /national[_-]?id/i,
    /email/i, /phone/i, /mobile/i, /address/i, /birth/i, /dob/i,
    /firstname/i, /lastname/i, /full[_-]?name/i, /gender/i,
    // Financial information
    /card[_-]?number/i, /credit[_-]?card/i, /debit/i, /cvv/i, /cvc/i,
    /iban/i, /account[_-]?number/i, /routing/i, /bank/i, /balance/i,
    /salary/i, /income/i, /payment/i, /billing/i, /tax/i
  ];

  // Value patterns that look like sensitive data regardless of key name.
  const SENSITIVE_VALUE_PATTERNS = [
    /\b\d{13,19}\b/,                                   // long digit runs (card numbers)
    /\b\d{3}-\d{2}-\d{4}\b/,                            // US SSN format
    /[A-Za-z0-9._-]{20,}\.[A-Za-z0-9._-]{20,}\.[A-Za-z0-9._-]{20,}/, // JWT-like
    /[\w.+-]+@[\w-]+\.[\w.-]+/,                         // email
    /-----BEGIN [A-Z ]+PRIVATE KEY-----/               // private keys
  ];

  function matchesAny(str, patterns) {
    for (let i = 0; i < patterns.length; i++) {
      if (patterns[i].test(str)) return true;
    }
    return false;
  }

  // Recursively inspect parsed data for sensitive keys or values.
  function containsSensitiveData(data, depth) {
    depth = depth || 0;
    if (depth > 20) return true; // be conservative on deep/recursive structures

    if (data === null || data === undefined) return false;

    const type = typeof data;

    if (type === 'string') {
      return matchesAny(data, SENSITIVE_VALUE_PATTERNS);
    }

    if (type === 'number' || type === 'boolean') {
      return false;
    }

    if (Array.isArray(data)) {
      for (let i = 0; i < data.length; i++) {
        if (containsSensitiveData(data[i], depth + 1)) return true;
      }
      return false;
    }

    if (type === 'object') {
      const keys = Object.keys(data);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (matchesAny(key, SENSITIVE_KEY_PATTERNS)) return true;
        if (containsSensitiveData(data[key], depth + 1)) return true;
      }
      return false;
    }

    // Unknown type — treat as not cacheable to be safe.
    return true;
  }

  function isCacheable(data) {
    try {
      return !containsSensitiveData(data, 0);
    } catch (e) {
      // On any inspection error, refuse to cache.
      return false;
    }
  }

  /**
   * Fetch an API resource with in-memory session caching for
   * non-sensitive responses only.
   *
   * @param {string} url     - The request URL (used as cache key).
   * @param {object} options  - fetch() options (optional).
   * @returns {Promise<any>}  - Parsed JSON response.
   */
  async function cachedFetch(url, options) {
    options = options || {};
    const method = (options.method || 'GET').toUpperCase();
    const key = method + ' ' + url;

    // Only GET requests are cached; others always hit the network.
    if (method === 'GET' && Object.prototype.hasOwnProperty.call(cache, key)) {
      // Return a defensive copy so callers can't mutate the cache.
      return JSON.parse(JSON.stringify(cache[key]));
    }

    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type') || '';

    let data;
    if (contentType.indexOf('application/json') !== -1) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Cache only successful, non-sensitive GET responses.
    if (method === 'GET' && response.ok && isCacheable(data)) {
      // Store a copy to keep the cache immutable from callers.
      cache[key] = JSON.parse(JSON.stringify(data));
    }

    return data;
  }

  /**
   * Clears the entire in-memory cache. Call this on logout.
   */
  function clearCache() {
    cache = Object.create(null);
  }

  // Ensure the cache never outlives the session/tab.
  window.addEventListener('pagehide', clearCache);
  window.addEventListener('beforeunload', clearCache);

  // Expose the API.
  window.cachedFetch = cachedFetch;
  window.clearCache = clearCache;
})();

// Example usage:
// cachedFetch('/api/public/articles')
//   .then(function (data