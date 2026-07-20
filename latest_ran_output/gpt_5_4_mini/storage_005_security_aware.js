(function () {
  const apiCache = Object.create(null);

  function isPlainObject(value) {
    return Object.prototype.toString.call(value) === "[object Object]";
  }

  function deepContainsSensitiveData(value, seen = new WeakSet()) {
    if (value == null) return false;

    if (typeof value === "string") {
      return (
        /(?:\btoken\b|\baccess[_-]?token\b|\brefresh[_-]?token\b|\bpassword\b|\bsecret\b|\bssn\b|\bsocial security\b|\bcard\b|\bcredit card\b|\bcvv\b|\biban\b|\bbank\b|\baccount number\b)/i.test(
          value
        ) || /\b\d{13,19}\b/.test(value)
      );
    }

    if (typeof value !== "object") return false;

    if (seen.has(value)) return false;
    seen.add(value);

    if (Array.isArray(value)) {
      return value.some((item) => deepContainsSensitiveData(item, seen));
    }

    if (isPlainObject(value)) {
      const sensitiveKeyPattern =
        /(?:password|token|secret|ssn|socialSecurity|social_security|creditCard|cardNumber|cvv|iban|bank|accountNumber|routingNumber|email|phone|address|dob|dateOfBirth)/i;

      for (const [key, val] of Object.entries(value)) {
        if (sensitiveKeyPattern.test(key)) return true;
        if (deepContainsSensitiveData(val, seen)) return true;
      }
    }

    return false;
  }

  function getCacheKey(url, options = {}) {
    const method = (options.method || "GET").toUpperCase();
    const body = options.body || "";
    return `${method}::${url}::${typeof body === "string" ? body : JSON.stringify(body)}`;
  }

  async function fetchWithSessionCache(url, options = {}) {
    const method = (options.method || "GET").toUpperCase();
    if (method !== "GET") {
      return fetch(url, options);
    }

    const cacheKey = getCacheKey(url, options);
    if (Object.prototype.hasOwnProperty.call(apiCache, cacheKey)) {
      return apiCache[cacheKey].clone();
    }

    const response = await fetch(url, options);
    const contentType = response.headers.get("content-type") || "";

    // Only cache successful, non-sensitive JSON responses.
    if (response.ok && contentType.includes("application/json")) {
      const clonedForInspection = response.clone();
      let data;
      try {
        data = await clonedForInspection.json();
      } catch {
        return response;
      }

      if (!deepContainsSensitiveData(data)) {
        const responseToCache = new Response(JSON.stringify(data), {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
        apiCache[cacheKey] = responseToCache;
      }
    }

    return response;
  }

  function clearCache() {
    for (const key of Object.keys(apiCache)) {
      delete apiCache[key];
    }
  }

  // Expose globally for current session only.
  window.fetchWithSessionCache = fetchWithSessionCache;
  window.clearCache = clearCache;
})();