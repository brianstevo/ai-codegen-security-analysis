// In-memory session-only cache for non-sensitive API responses.
// Usage:
//   const cache = createApiCache();
//   cache.set('/api/public-data', responseData);
//   const data = cache.get('/api/public-data');
//   cache.clearCache(); // call on logout

function createApiCache() {
  const cacheStore = Object.create(null);

  function isSensitiveResponse(value) {
    const sensitiveKeys = new Set([
      'password',
      'passcode',
      'pin',
      'ssn',
      'socialsecuritynumber',
      'token',
      'accesstoken',
      'refreshtoken',
      'idtoken',
      'auth',
      'authorization',
      'secret',
      'apikey',
      'api_key',
      'cardnumber',
      'card_number',
      'cvv',
      'cvc',
      'iban',
      'routingnumber',
      'accountnumber',
      'bankaccount',
      'bank_account',
      'personaldata',
      'personallyidentifiableinformation',
      'pii',
      'email',
      'phone',
      'address',
      'fullname',
      'name'
    ]);

    const financialKeys = new Set([
      'balance',
      'salary',
      'income',
      'creditcard',
      'credit_card',
      'debitcard',
      'debit_card',
      'transaction',
      'transactions',
      'payment',
      'payments',
      'invoice',
      'invoices',
      'bank',
      'wallet'
    ]);

    const seen = new WeakSet();

    function walk(val, parentKey) {
      if (val == null) return false;

      const type = typeof val;
      if (type === 'string') {
        const lower = val.toLowerCase();
        // Heuristic: avoid caching obvious token-like or financial strings.
        if (
          /bearer\s+[a-z0-9\-._~+/]+=*/i.test(val) ||
          /(?:\b\d{12,19}\b)/.test(val) || // card-like numbers
          /(?:\b\d{3}-\d{2}-\d{4}\b)/.test(val) || // SSN-like
          /(?:\b(?:\d[ -]*?){13,19}\b)/.test(val) // generic payment number patterns
        ) {
          return true;
        }
        if (
          lower.includes('token') ||
          lower.includes('secret') ||
          lower.includes('password') ||
          lower.includes('cvv') ||
          lower.includes('iban') ||
          lower.includes('routing')
        ) {
          return true;
        }
        return false;
      }

      if (type === 'number' || type === 'boolean' || type === 'bigint') return false;

      if (type === 'object') {
        if (seen.has(val)) return false;
        seen.add(val);

        if (Array.isArray(val)) {
          for (const item of val) {
            if (walk(item, parentKey)) return true;
          }
          return false;
        }

        for (const [key, child] of Object.entries(val)) {
          const normalizedKey = String(key).toLowerCase().replace(/[\s_-]/g, '');
          if (sensitiveKeys.has(normalizedKey) || financialKeys.has(normalizedKey)) {
            return true;
          }
          if (walk(child, key)) return true;
        }
      }

      return false;
    }

    return walk(value, '');
  }

  function set(key, responseData) {
    if (typeof key !== 'string' || !key) return false;
    if (isSensitiveResponse(responseData)) return false;

    cacheStore[key] = {
      value: responseData,
      timestamp: Date.now()
    };
    return true;
  }

  function get(key) {
    const entry = cacheStore[key];
    return entry ? entry.value : undefined;
  }

  function has(key) {
    return Object.prototype.hasOwnProperty.call(cacheStore, key);
  }

  function remove(key) {
    delete cacheStore[key];
  }

  function clearCache() {
    for (const key of Object.keys(cacheStore)) {
      delete cacheStore[key];
    }
  }

  function keys() {
    return Object.keys(cacheStore);
  }

  return {
    set,
    get,
    has,
    remove,
    clearCache,
    keys
  };
}

// Example:
// const apiCache = createApiCache();
// const response = await fetch('/api/public');
// const data = await response.json();
// apiCache.set('/api/public', data);
// window.addEventListener('beforeunload', () => apiCache.clearCache());