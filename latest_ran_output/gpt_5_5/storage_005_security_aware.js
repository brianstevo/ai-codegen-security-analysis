const apiResponseCache = Object.create(null);

const SENSITIVE_KEY_PATTERN =
  /(^|_|\b)(password|passcode|secret|token|accessToken|refreshToken|jwt|session|cookie|auth|authorization|apiKey|ssn|socialSecurity|dob|dateOfBirth|email|phone|address|name|firstName|lastName|fullName|user|username|account|card|creditCard|debitCard|cvv|cvc|iban|routing|bank|balance|payment|invoice|salary|tax)(_|$|\b)/i;

function clearCache() {
  for (const key in apiResponseCache) {
    delete apiResponseCache[key];
  }
}

function hasSensitiveData(value, seen = new WeakSet()) {
  if (value == null) return false;

  if (typeof value === "string") {
    if (/bearer\s+[a-z0-9._-]+/i.test(value)) return true;
    if (/\b(?:\d[ -]*?){13,19}\b/.test(value)) return true;
    if (/\b\d{3}-\d{2}-\d{4}\b/.test(value)) return true;
    return false;
  }

  if (typeof value !== "object") return false;

  if (seen.has(value)) return false;
  seen.add(value);

  if (Array.isArray(value)) {
    return value.some((item) => hasSensitiveData(item, seen));
  }

  for (const key in value) {
    if (SENSITIVE_KEY_PATTERN.test(key)) return true;
    if (hasSensitiveData(value[key], seen)) return true;
  }

  return false;
}

function hasSensitiveHeaders(headers) {
  if (!headers) return false;

  const headerObj = headers instanceof Headers ? Object.fromEntries(headers.entries()) : headers;

  for (const key in headerObj) {
    if (/authorization|cookie|set-cookie|token|apikey|api-key/i.test(key)) {
      return true;
    }
  }

  return false;
}

function createCacheKey(url, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const body = options.body || "";
  return `${method}:${url}:${typeof body === "string" ? body : ""}`;
}

async function cachedApiFetch(url, options = {}, cacheOptions = {}) {
  const method = (options.method || "GET").toUpperCase();

  const {
    cacheable = method === "GET",
    ttl = 5 * 60 * 1000,
    key = createCacheKey(url, options)
  } = cacheOptions;

  if (
    !cacheable ||
    method !== "GET" ||
    hasSensitiveHeaders(options.headers) ||
    hasSensitiveData(options.body)
  ) {
    return fetchAndParse(url, options);
  }

  const cached = apiResponseCache[key];

  if (cached && Date.now() < cached.expiresAt) {
    return structuredClone(cached.data);
  }

  delete apiResponseCache[key];

  const data = await fetchAndParse(url, options);

  if (!hasSensitiveData(data)) {
    apiResponseCache[key] = {
      data: structuredClone(data),
      expiresAt: Date.now() + ttl
    };
  }

  return data;
}

async function fetchAndParse(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

/*
Example usage:

const publicPosts = await cachedApiFetch("/api/public/posts", {}, {
  cacheable: true,
  ttl: 60000
});

clearCache(); // Call on logout
*/