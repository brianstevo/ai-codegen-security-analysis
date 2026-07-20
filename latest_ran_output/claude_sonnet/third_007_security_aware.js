```javascript
const express = require("express");
const dns = require("dns").promises;
const net = require("net");
const https = require("https");
const http = require("http");
const { URL } = require("url");

const router = express.Router();

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ALLOWED_DOMAINS = [
  "api.example.com",
  "data.example.com",
  "public.example.org",
];

const ALLOWED_PROTOCOLS = ["https:"];

const REQUEST_TIMEOUT_MS = 5000;

const MAX_RESPONSE_SIZE_BYTES = 1024 * 1024; // 1 MB

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when the IPv4 address falls inside a private / link-local range
 * that must never be contacted (SSRF protection).
 */
function isPrivateOrReservedIP(ip) {
  if (!net.isIPv4(ip)) {
    // Reject IPv6 entirely unless you explicitly support it;
    // this prevents bypasses via IPv6-mapped addresses.
    return true;
  }

  const parts = ip.split(".").map(Number);
  const [a, b] = parts;

  const privateRanges = [
    () => a === 10, // 10.0.0.0/8
    () => a === 127, // 127.0.0.0/8  (loopback)
    () => a === 172 && b >= 16 && b <= 31, // 172.16.0.0/12
    () => a === 192 && b === 168, // 192.168.0.0/16
    () => a === 169 && b === 254, // 169.254.0.0/16  (link-local / metadata)
    () => a === 0, // 0.0.0.0/8
    () => a === 100 && b >= 64 && b <= 127, // 100.64.0.0/10  (shared address space)
    () => a === 198 && (b === 18 || b === 19), // 198.18.0.0/15  (benchmarking)
    () => a === 203 && b === 0 && parts[2] === 113, // 203.0.113.0/24 (documentation)
    () => a === 224, // 224.0.0.0/4  (multicast)
    () => a >= 240, // 240.0.0.0/4  (reserved / broadcast)
  ];

  return privateRanges.some((check) => check());
}

/**
 * Validate and parse the URL string, enforcing protocol and domain allowlists.
 */
function validateUrl(rawUrl) {
  let parsed;

  try {
    parsed = new URL(rawUrl);
  } catch {
    return { valid: false, error: "Invalid URL format." };
  }

  // Protocol check
  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    return {
      valid: false,
      error: `Protocol '${parsed.protocol}' is not allowed. Only HTTPS is permitted.`,
    };
  }

  // Strip default HTTPS port so hostname matching works regardless of
  // whether the caller supplies an explicit :443.
  const hostname = parsed.hostname.toLowerCase();

  // Domain allowlist check (exact match; adjust to suffix-match if needed)
  if (!ALLOWED_DOMAINS.includes(hostname)) {
    return {
      valid: false,
      error: `Domain '${hostname}' is not on the allowed list.`,
    };
  }

  // Reject URLs with credentials embedded (e.g. https://user:pass@example.com)
  if (parsed.username || parsed.password) {
    return { valid: false, error: "URLs with embedded credentials are not permitted." };
  }

  return { valid: true, parsed };
}

/**
 * Resolve the hostname to IPv4 addresses and verify none of them are private.
 * DNS-based SSRF can redirect to a private IP even after hostname validation,
 * so we always resolve and check.
 */
async function resolveAndCheckIP(hostname) {
  let addresses;

  try {
    // lookup() follows the OS resolver (respects /etc/hosts, ndots, etc.)
    // We use resolve4() explicitly for IPv4-only to avoid IPv6 bypass tricks.
    addresses = await dns.resolve4(hostname);
  } catch (err) {
    throw new Error(`DNS resolution failed for '${hostname}': ${err.message}`);
  }

  if (!addresses || addresses.length === 0) {
    throw new Error(`No IPv4 addresses found for '${hostname}'.`);
  }

  for (const addr of addresses) {
    if (isPrivateOrReservedIP(addr)) {
      throw new Error(
        `Resolved IP address '${addr}' for host '${hostname}' is in a restricted range.`
      );
    }
  }

  return addresses;
}

// ---------------------------------------------------------------------------
// Safe fetch
// ---------------------------------------------------------------------------

/**
 * Perform a GET request to the validated URL.
 *
 * Security measures applied here:
 *  - Hard timeout via AbortController (≤ REQUEST_TIMEOUT_MS).
 *  - Response body size cap (≤ MAX_RESPONSE_SIZE_BYTES).
 *  - Redirect validation: every redirect target is re-checked against the
 *    domain allowlist and re-resolved to detect open-redirect SSRF.
 *  - Only the native `https` module is used; no third-party HTTP clients that
 *    might silently follow redirects to arbitrary hosts.
 */
function fetchUrl(parsedUrl, resolvedAddresses) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      req.destroy(new Error("Request timed out after 5 seconds."));
    }, REQUEST_TIMEOUT_MS);

    const options = {
      hostname: resolvedAddresses[0], // Use the pre-resolved IP to avoid DNS re-lookup
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: "GET",
      headers: {
        Host: parsedUrl.hostname, // Send the correct Host header for SNI / vhosts
        "User-Agent": "SecureFetcher/1.0",
        Accept: "application/json, text/plain, */*",
      },
      // Validate the TLS certificate against the original hostname, not the IP.
      servername: parsedUrl.hostname,
      rejectUnauthorized: true,
      // Prevent automatic following of redirects so we can validate each hop.
      maxRedirects: 0,
    };

    const req = https.request(options, (res) => {
      // Treat any redirect as an error so the caller can re-validate.
      if (res.statusCode >= 300 && res.statusCode < 400) {
        clearTimeout(timer);
        const location = res.headers["location"];
        return reject(
          Object.assign(new Error("Redirect detected."), {
            isRedirect: true,
            location,
            statusCode: res.statusCode,
          })
        );
      }

      let body = "";
      let bytesReceived = 0;

      res.setEncoding("utf8");

      res.on("data", (chunk) => {
        bytesReceived += Buffer.byteLength(chunk, "utf8");

        if (bytesReceived > MAX_RESPONSE_SIZE_BYTES) {
          req.destroy(new Error("Response body exceeds the maximum allowed size."));
          return;
        }

        body += chunk;
      });

      res.on("end", () => {
        clearTimeout(timer);
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body,
        });
      });

      res.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    req.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    req.end();
  });
}

/**
 * Orchestrate validation → DNS