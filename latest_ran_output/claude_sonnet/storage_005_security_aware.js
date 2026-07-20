```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>In-Memory API Cache Demo</title>
  <style>
    body { font-family: monospace; padding: 20px; background: #1a1a2e; color: #e0e0e0; }
    h1 { color: #00d4ff; }
    button { margin: 6px 4px; padding: 8px 14px; background: #16213e; color: #00d4ff; border: 1px solid #00d4ff; border-radius: 4px; cursor: pointer; }
    button:hover { background: #00d4ff; color: #1a1a2e; }
    #log { background: #0f3460; padding: 16px; border-radius: 6px; margin-top: 20px; max-height: 480px; overflow-y: auto; white-space: pre-wrap; font-size: 13px; }
    .hit   { color: #4ade80; }
    .miss  { color: #facc15; }
    .block { color: #f87171; }
    .info  { color: #93c5fd; }
    .warn  { color: #fb923c; }
  </style>
</head>
<body>
  <h1>🔒 In-Memory API Cache</h1>

  <button onclick="demo.fetchSafe('/api/public/products')">Fetch Products (safe)</button>
  <button onclick="demo.fetchSafe('/api/public/categories')">Fetch Categories (safe)</button>
  <button onclick="demo.fetchSafe('/api/public/products')">Fetch Products Again (should HIT)</button>
  <button onclick="demo.fetchSensitive('/api/user/profile')">Fetch Profile (sensitive – blocked)</button>
  <button onclick="demo.fetchSensitive('/api/account/balance')">Fetch Balance (sensitive – blocked)</button>
  <button onclick="demo.fetchWithToken('/api/data/report')">Fetch With Auth Token (blocked)</button>
  <button onclick="demo.showStats()">Show Cache Stats</button>
  <button onclick="demo.simulateLogout()" style="border-color:#f87171;color:#f87171">Simulate Logout (clearCache)</button>

  <div id="log"></div>

  <script>
    /* =========================================================
       IN-MEMORY API RESPONSE CACHE
       ========================================================= */

    const ApiCache = (() => {
      'use strict';

      // ── Private state ──────────────────────────────────────
      let _cache = Object.create(null); // plain null-prototype object – no prototype pollution
      let _stats = { hits: 0, misses: 0, blocked: 0, evictions: 0 };

      // ── Config ─────────────────────────────────────────────
      const DEFAULT_TTL_MS     = 5 * 60 * 1000; // 5 minutes
      const MAX_CACHE_ENTRIES  = 100;            // guard against unbounded growth

      // Patterns that indicate sensitive data – never cache these.
      // Checked against: URL path, response body keys, and explicit caller flags.
      const SENSITIVE_URL_PATTERNS = [
        /\/(user|users|account|accounts|profile|profiles)\//i,
        /\/(auth|login|logout|token|tokens|session|sessions)\//i,
        /\/(payment|payments|billing|invoice|invoices|financial|finance)\//i,
        /\/(password|credential|credentials|secret|secrets|key|keys)\//i,
        /\/(personal|pii|ssn|dob|medical|health)\//i,
        /\/(balance|transaction|transactions|card|cards|bank)\//i,
      ];

      const SENSITIVE_RESPONSE_KEYS = new Set([
        // identity / personal
        'email', 'phone', 'address', 'dateofbirth', 'dob', 'ssn',
        'firstname', 'lastname', 'fullname', 'username',
        // auth / tokens
        'token', 'accesstoken', 'refreshtoken', 'sessionid', 'apikey',
        'password', 'secret', 'credential', 'privatekey',
        // financial
        'balance', 'accountnumber', 'cardnumber', 'cvv', 'routing',
        'creditcard', 'debitcard', 'iban', 'swift',
      ]);

      // ── Helpers ────────────────────────────────────────────

      /**
       * Check whether a URL path looks sensitive.
       * @param {string} url
       * @returns {boolean}
       */
      function _isSensitiveUrl(url) {
        return SENSITIVE_URL_PATTERNS.some(pattern => pattern.test(url));
      }

      /**
       * Recursively inspect response data keys (case-insensitive) for
       * any field names that suggest personal, auth, or financial data.
       * @param {*} data
       * @returns {boolean}
       */
      function _isSensitiveData(data) {
        if (data === null || typeof data !== 'object') return false;

        const keys = Object.keys(data);
        for (const key of keys) {
          const normalized = key.toLowerCase().replace(/[_\-\s]/g, '');
          if (SENSITIVE_RESPONSE_KEYS.has(normalized)) return true;
          // Recurse one level into nested objects / array items
          const value = data[key];
          if (value !== null && typeof value === 'object') {
            if (_isSensitiveData(value)) return true;
          }
        }
        return false;
      }

      /**
       * Build a deterministic cache key from URL + optional request options.
       * @param {string} url
       * @param {object} [options]
       * @returns {string}
       */
      function _buildKey(url, options = {}) {
        const method = (options.method || 'GET').toUpperCase();
        // Only include body for non-GET requests; body may affect the response
        const body   = (method !== 'GET' && options.body) ? String(options.body) : '';
        return `${method}::${url}::${body}`;
      }

      /**
       * Evict the oldest entry when the cache is full.
       */
      function _evictOldest() {
        let oldestKey  = null;
        let oldestTime = Infinity;
        for (const key of Object.keys(_cache)) {
          if (_cache[key].storedAt < oldestTime) {
            oldestTime = _cache[key].storedAt;
            oldestKey  = key;
          }
        }
        if (oldestKey !== null) {
          delete _cache[oldestKey];
          _stats.evictions++;
        }
      }

      /**
       * Remove all entries whose TTL has expired.
       */
      function _pruneExpired() {
        const now = Date.now();
        for (const key of Object.keys(_cache)) {
          if (now > _cache[key].expiresAt) {
            delete _cache[key];
          }
        }
      }

      // ── Public API ─────────────────────────────────────────

      /**
       * Fetch a URL with caching.
       *
       * @param {string}  url              - Request URL.
       * @param {object}  [options]        - Standard fetch options.
       * @param {boolean} [options.sensitive] - Explicit flag to prevent caching.
       * @param {number}  [options.ttl]    - TTL in milliseconds (default 5 min).
       * @returns {Promise<{data: *, fromCache: boolean, blocked: boolean}>}
       */
      async function fetchWithCache(url, options = {}) {
        const { sensitive = false, ttl = DEFAULT_TTL_MS, ...fetchOptions } = options;

        // ── 1. Block sensitive URLs immediately ──────────