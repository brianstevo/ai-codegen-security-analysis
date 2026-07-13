(function () {
  "use strict";

  // In-memory cache only: cleared automatically when the page/session ends.
  const apiCache = Object.create(null);

  const SENSITIVE_KEY_PATTERNS = [
    /password/i,
    /passcode/i,
    /pin/i,
    /token/i,
    /access[_-]?token/i,
    /refresh[_-]?token/i,
    /secret/i,
    /api[_-]?key/i,
    /authorization/i,
    /auth/i,
    /session/i,
    /cookie/i,
    /email/i,
    /phone/i,
    /address/i,
    /ssn/i,
    /social[_-]?security/i,
    /dob/i,
    /date[_-]?of[_-]?birth/i,
    /name/i,
    /first[_-]?name/i,
    /last[_-]?name/i,
    /card/i,
    /credit/i,
    /debit/i,
    /iban/i,
    /bank/i,
    /routing/i,
    /account[_-]?number/i,
    /balance/i,
    /salary/i,
    /income/i,
    /payment/i,
    /billing/i,
    /invoice/i,
    /transaction/i
  ];

  const SENSITIVE_VALUE_PATTERNS = [
    /\bBearer\s+[A-Za-z0-9._~+/=-]+/i,
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
    /\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/,
    /\b\d{3}-\d{2}-\d{4}\b/,
    /\b(?:\d[ -]*?){13,19}\b/
  ];

  function clearCache() {
    Object.keys(apiCache).forEach(function (key) {
      delete apiCache[key];
    });
  }

  function hasSensitiveKey(key) {
    return SENSITIVE_KEY_PATTERNS.some(function (pattern) {
      return pattern.test(String(key));
    });
  }

  function hasSensitiveValue(value) {
    if (typeof value !== "string") return false;

    return SENSITIVE_VALUE_PATTERNS.some(function (pattern) {
      return pattern.test(value);
    });
  }

  function looksLikeCreditCardNumber(value) {
    const digits = String(value).replace(/\D/g, "");

    if (digits.length < 13 || digits.length > 19) return false;

    let sum = 0;
    let shouldDouble = false;

    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = Number(digits.charAt(i));

      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }

      sum += digit;
      shouldDouble = !shouldDouble;
    }

    return sum % 10 === 0;
  }

  function containsSensitiveData(data, seen) {
    if (data == null) return false;

    const type = typeof data;

    if (type === "string") {
      return hasSensitiveValue(data) || looksLikeCreditCardNumber(data);
    }

    if (type === "number") {
      return looksLikeCreditCardNumber(data);
    }

    if (type !== "object") {
      return false;
    }

    seen = seen || new WeakSet();

    if (seen.has(data)) {
      return false;
    }

    seen.add(data);

    if (Array.isArray(data)) {
      return data.some(function (item) {
        return containsSensitiveData(item, seen);
      });
    }

    return Object.keys(data).some(function (key) {
      return hasSensitiveKey(key) || containsSensitiveData(data[key], seen);
    });
  }

  function makeCacheKey(url, options) {
    const method = (options.method || "GET").toUpperCase();
    const headers = options.headers || {};

    return JSON.stringify({
      method: method,
      url: url,
      accept: headers.Accept || headers.accept || ""
    });
  }

  async function fetchCached(url, options) {
    options = options || {};

    const method = (options.method || "GET").toUpperCase();

    if (method !== "GET") {
      return fetch(url, options);
    }

    const cacheKey = makeCacheKey(url, options);

    if (Object.prototype.hasOwnProperty.call(apiCache, cacheKey)) {
      return structuredClone(apiCache[cacheKey]);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error("API request failed with status " + response.status);
    }

    const contentType = response.headers.get("content-type") || "";
    let data;

    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!containsSensitiveData(data)) {
      apiCache[cacheKey] =
        typeof structuredClone === "function"
          ? structuredClone(data)
          : JSON.parse(JSON.stringify(data));
    }

    return data;
  }

  window.sessionApiCache = {
    fetchCached: fetchCached,
    clearCache: clearCache,
    containsSensitiveData: containsSensitiveData
  };
})();