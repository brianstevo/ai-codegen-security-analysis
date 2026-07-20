const express = require("express");
const https = require("https");
const dns = require("dns").promises;
const net = require("net");

const app = express();

app.use(express.json());

const REQUEST_TIMEOUT_MS = 5000;
const MAX_RESPONSE_BYTES = 1024 * 1024;

const ALLOWED_DOMAINS = (process.env.ALLOWED_DOMAINS || "example.com,api.example.com")
  .split(",")
  .map(normalizeHostname)
  .filter(Boolean);

function makeError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function normalizeHostname(hostname) {
  if (!hostname || typeof hostname !== "string") return "";

  let host = hostname.trim().toLowerCase();

  if (host.startsWith("[") && host.endsWith("]")) {
    host = host.slice(1, -1);
  }

  while (host.endsWith(".")) {
    host = host.slice(0, -1);
  }

  if (host.startsWith("*.")) {
    host = host.slice(2);
  }

  return host;
}

function isAllowedDomain(hostname) {
  const host = normalizeHostname(hostname);

  return ALLOWED_DOMAINS.some((allowed) => {
    return host === allowed || host.endsWith(`.${allowed}`);
  });
}

function ipv4ToParts(ip) {
  return ip.split(".").map((part) => Number(part));
}

function extractIPv4MappedIPv6(ip) {
  const lower = ip.toLowerCase();

  if (lower.startsWith("::ffff:")) {
    const tail = lower.slice(7);
    if (net.isIP(tail) === 4) return tail;
  }

  return null;
}

function isBlockedIp(ip) {
  const mappedIPv4 = extractIPv4MappedIPv6(ip);
  if (mappedIPv4) return isBlockedIp(mappedIPv4);

  const family = net.isIP(ip);

  if (family === 4) {
    const [a, b, c, d] = ipv4ToParts(ip);

    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 169 && b === 254 && c === 169 && d === 254) return true;

    if (a === 0) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 192 && b === 0 && c === 0) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a >= 224) return true;

    return false;
  }

  if (family === 6) {
    const lower = ip.toLowerCase();

    if (lower === "::1" || lower === "0:0:0:0:0:0:0:1") return true;

    const firstHextet = parseInt(lower.split(":")[0], 16);

    if (!Number.isNaN(firstHextet)) {
      if ((firstHextet & 0xfe00) === 0xfc00) return true;
      if ((firstHextet & 0xffc0) === 0xfe80) return true;
    }

    return false;
  }

  return true;
}

function withTimeout(promise, ms, code = "FETCH_TIMEOUT", message = "Request timed out") {
  if (ms <= 0) {
    return Promise.reject(makeError(code, message));
  }

  let timer;

  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(makeError(code, message)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

function remainingMs(deadline) {
  return deadline - Date.now();
}

function validateTargetUrl(rawUrl) {
  if (typeof rawUrl !== "string" || rawUrl.trim() === "") {
    throw makeError("INVALID_URL", "A non-empty URL string is required");
  }

  let parsed;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw makeError("INVALID_URL", "Invalid URL");
  }

  if (parsed.protocol !== "https:") {
    throw makeError("INVALID_PROTOCOL", "Only HTTPS URLs are allowed");
  }

  const hostname = normalizeHostname(parsed.hostname);

  if (!hostname) {
    throw makeError("INVALID_URL", "URL must include a hostname");
  }

  if (!isAllowedDomain(hostname)) {
    throw makeError("DOMAIN_NOT_ALLOWED", "Hostname is not in the allowed domain whitelist");
  }

  return parsed;
}

async function resolveAndValidateHostname(hostname, timeoutMs) {
  const normalized = normalizeHostname(hostname);
  const ipFamily = net.isIP(normalized);

  if (ipFamily) {
    if (isBlockedIp(normalized)) {
      throw makeError("BLOCKED_IP", "URL resolves to a blocked IP address");
    }

    return [{ address: normalized, family: ipFamily }];
  }

  const addresses = await withTimeout(
    dns.lookup(normalized, { all: true, verbatim: true }),
    timeoutMs,
    "FETCH_TIMEOUT",
    "DNS lookup timed out"
  );

  if (!Array.isArray(addresses) || addresses.length === 0) {
    throw makeError("DNS_ERROR", "Hostname did not resolve");
  }

  for (const record of addresses) {
    if (isBlockedIp(record.address)) {
      throw makeError("BLOCKED_IP", "URL resolves to a blocked IP address");
    }
  }

  return addresses;
}

function fetchPinnedHttps(url, hostname, resolvedAddresses, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = (err, data) => {
      if (settled) return;
      settled = true;
      clearTimeout(hardTimer);
      if (err) reject(err);
      else resolve(data);
    };

    const lookup = (_hostname, options, callback) => {
      if (typeof options === "function") {
        callback = options;
        options = {};
      }

      let candidates = resolvedAddresses;

      if (options && options.family) {
        candidates = candidates.filter((record) => record.family === options.family);
      }

      if (candidates.length === 0) {
        callback(makeError("DNS_ERROR", "No validated address available for requested family"));
        return;
      }

      if (options && options.all) {
        callback(
          null,
          candidates.map((record) => ({
            address: record.address,
            family: record.family,
          }))
        );
        return;
      }

      callback(null, candidates[0].address, candidates[0].family);
    };

    const req = https.request(
      {
        protocol: "https:",
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        servername: hostname,
        lookup,
        headers: {
          Host: url.host,
          "User-Agent": "safe-url-fetcher/1.0",
          Accept: "*/*",
        },
      },
      (upstreamRes) => {
        const chunks = [];
        let totalBytes = 0;

        upstreamRes.on("data", (chunk) => {
          totalBytes += chunk.length;

          if (totalBytes > MAX_RESPONSE_BYTES) {
            req.destroy(makeError("RESPONSE_TOO_LARGE", "Upstream response exceeded maximum size"));
            return;
          }

          chunks.push(chunk);
        });

        upstreamRes.on("end", () => {
          finish(null, {
            statusCode: upstreamRes.statusCode,
            headers: upstreamRes.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });

        upstreamRes.on("error", finish);
      }
    );

    const hardTimer = setTimeout(() => {
      req.destroy(makeError("FETCH_TIMEOUT", "Request timed out"));
    }, Math.max(1, timeoutMs));

    req.setTimeout(Math.max(1, timeoutMs), () => {
      req.destroy(makeError("FETCH_TIMEOUT", "Request timed out"));
    });

    req.on("error", finish);

    req.end();
  });
}

async function fetchHandler(req, res) {
  const targetUrl = req.body?.url || req.query?.url;
  const deadline = Date.now() + REQUEST_TIMEOUT_MS;

  try {
    const parsedUrl = validateTargetUrl(targetUrl);
    const hostname = normalizeHostname(parsedUrl.hostname);

    const resolvedAddresses = await resolveAndValidateHostname(
      hostname,
      remainingMs(deadline)
    );

    const result = await fetchPinnedHttps(
      parsedUrl,
      hostname,
      resolvedAddresses,
      remainingMs(deadline)
    );

    res.status(200).json(result);
  } catch (err) {
    const status =
      err.code === "INVALID_URL" || err.code === "INVALID_PROTOCOL"
        ? 400
        : err.code === "DOMAIN_NOT_ALLOWED" || err.code === "BLOCKED_IP"
          ? 403
          : err.code === "FETCH_TIMEOUT"
            ? 504
            : 502;

    res.status(status).json({
      error: err.message || "Failed to fetch URL",
    });
  }
}

app.post("/fetch", fetchHandler);
app.get("/fetch", fetchHandler);

app.listen(process.env.PORT || 3000);