```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>In-Memory API Cache Demo</title>
  <style>
    body { font-family: monospace; max-width: 800px; margin: 2rem auto; padding: 1rem; background: #1e1e1e; color: #d4d4d4; }
    h1 { color: #569cd6; }
    button { margin: 0.25rem; padding: 0.5rem 1rem; background: #264f78; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-family: monospace; }
    button:hover { background: #3a6fa8; }
    button.danger { background: #8b1a1a; }
    button.danger:hover { background: #b22222; }
    pre { background: #252526; border: 1px solid #3c3c3c; border-radius: 4px; padding: 1rem; overflow-x: auto; white-space: pre-wrap; word-break: break-all; }
    .label { color: #9cdcfe; }
    .hit  { color: #4ec9b0; }
    .miss { color: #ce9178; }
    .skip { color: #dcdcaa; }
    .warn { color: #f44747; }
    .info { color: #569cd6; }
  </style>
</head>
<body>
  <h1>🔒 In-Memory API Cache</h1>

  <div>
    <button onclick="demo.publicData()">Fetch Public Data (cacheable)</button>
    <button onclick="demo.publicDataAgain()">Fetch Same Public Data (should hit cache)</button>
    <button onclick="demo.sensitiveData()">Fetch Sensitive Data (must NOT cache)</button>
    <button onclick="demo.financialData()">Fetch Financial Data (must NOT cache)</button>
    <button onclick="demo.tokenData()">Fetch Token Data (must NOT cache)</button>
    <button onclick="demo.expiredEntry()">Fetch With Short TTL (1 s)</button>
    <button onclick="demo.showCacheState()">Show Cache State</button>
    <button class="danger" onclick="demo.logout()">Logout (Clear Cache)</button>
  </div>

  <pre id="output">// Output will appear here…</pre>

  <script>
    /* =========================================================
       IN-MEMORY API CACHE  – session only, no sensitive data
       ========================================================= */
    const ApiCache = (() => {
      'use strict';

      // ── Private state ──────────────────────────────────────
      let _cache = Object.create(null); // plain null-prototype object

      // Default TTL: 5 minutes (ms). Pass 0 for "no expiry".
      const DEFAULT_TTL = 5 * 60 * 1000;

      // ── Sensitive-field detection ──────────────────────────
      // Keys (case-insensitive) that signal personal / financial / auth data.
      const SENSITIVE_KEY_PATTERNS = [
        /\btoken\b/i,
        /\bpassword\b/i,
        /\bpasswd\b/i,
        /\bsecret\b/i,
        /\bapikey\b/i,
        /\bapi_key\b/i,
        /\bauth\b/i,
        /\bcredit.?card\b/i,
        /\bcard.?number\b/i,
        /\bcvv\b/i,
        /\bssn\b/i,
        /\bsocial.?security\b/i,
        /\baccount.?number\b/i,
        /\biban\b/i,
        /\brouting.?number\b/i,
        /\bprivate.?key\b/i,
        /\bsession/i,
        /\bcookie\b/i,
        /\bemail\b/i,
        /\bphone\b/i,
        /\baddress\b/i,
        /\bdob\b/i,
        /\bdate.?of.?birth\b/i,
        /\bpassport\b/i,
        /\blicense\b/i,
        /\bbalance\b/i,
        /\btransaction\b/i,
        /\bpayment\b/i,
        /\binvoice\b/i,
        /\btax\b/i,
        /\bsalary\b/i,
        /\bwage\b/i,
        /\bpii\b/i,
      ];

      /**
       * Recursively walk an object/array and return true if any key name
       * matches one of the sensitive patterns.
       *
       * @param {*}   value     – The parsed response body.
       * @param {number} depth  – Recursion guard (max 10 levels).
       * @returns {boolean}
       */
      function _containsSensitiveKeys(value, depth = 0) {
        if (depth > 10 || value === null || typeof value !== 'object') return false;

        const keys = Object.keys(value);

        for (const key of keys) {
          // Check the key name itself
          if (SENSITIVE_KEY_PATTERNS.some(re => re.test(key))) return true;

          // Recurse into nested objects / arrays
          const child = value[key];
          if (child !== null && typeof child === 'object') {
            if (_containsSensitiveKeys(child, depth + 1)) return true;
          }
        }
        return false;
      }

      /**
       * Inspect URL and explicit opts.sensitive flag.
       * URLs that look like auth / payment endpoints are always skipped.
       *
       * @param {string}  url
       * @param {object}  opts
       * @returns {boolean}
       */
      function _urlLooksSensitive(url, opts = {}) {
        if (opts.sensitive === true) return true;

        const SENSITIVE_URL_PATTERNS = [
          /\/auth\b/i,
          /\/login\b/i,
          /\/logout\b/i,
          /\/token\b/i,
          /\/password\b/i,
          /\/payment\b/i,
          /\/checkout\b/i,
          /\/billing\b/i,
          /\/account\b/i,
          /\/profile\b/i,
          /\/user\b/i,
          /\/me\b/i,
          /\/financial\b/i,
          /\/transaction\b/i,
          /\/invoice\b/i,
          /\/credit\b/i,
          /\/sensitive\b/i,
        ];

        return SENSITIVE_URL_PATTERNS.some(re => re.test(url));
      }

      // ── Cache key ──────────────────────────────────────────
      function _buildKey(url, params = {}) {
        const sorted = JSON.stringify(
          Object.keys(params).sort().reduce((acc, k) => { acc[k] = params[k]; return acc; }, {})
        );
        return `${url}::${sorted}`;
      }

      // ── Cache read ─────────────────────────────────────────
      function get(key) {
        const entry = _cache[key];
        if (!entry) return null;

        if (entry.expiresAt && Date.now() > entry.expiresAt) {
          delete _cache[key]; // evict stale entry
          return null;
        }
        return entry.data;
      }

      // ── Cache write ────────────────────────────────────────
      function set(key, data, ttl = DEFAULT_TTL) {
        _cache[key] = {
          data,
          storedAt: Date.now(),