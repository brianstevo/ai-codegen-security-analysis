const express = require("express");
const http = require("http");
const https = require("https");
const dns = require("dns").promises;
const net = require("net");

const app = express();

app.use(express.json({ limit: "16kb" }));

const PORT = process.env.PORT || 3000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;
const USER_AGENT = "SafeExpressUrlFetcher/1.0";

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

class FetchError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

function stripBrackets(hostname) {
  if (
    typeof hostname === "string" &&
    hostname.startsWith("[") &&
    hostname.endsWith("]")
  ) {
    return hostname.slice(1, -1);
  }

  return hostname;
}

function ipv4ToLong(ip) {
  if (net.isIP(ip) !== 4) {
    throw new Error("Invalid IPv4 address");
  }

  const parts = ip.split(".").map(Number);

  return (
    parts[0] * 256 ** 3 +
    parts[1] * 256 ** 2 +
    parts[2] * 256 +
    parts[3]
  );
}

function isIpv4InCidr(ipLong, baseLong, prefixLength) {
  const blockSize = 2 ** (32 - prefixLength);
  return Math.floor(ipLong / blockSize) === Math.floor(baseLong / blockSize);
}

const BLOCKED_IPV4_CIDRS = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
  ["255.255.255.255", 32],
].map(([base, prefix]) => [ipv4ToLong(base), prefix]);

function isPublicIpv4(ip) {
  const ipLong = ipv4ToLong(ip);

  return !BLOCKED_IPV4_CIDRS.some(([baseLong, prefix]) =>
    isIpv4InCidr(ipLong, baseLong, prefix)
  );
}

function parseIpv6Part(part) {
  if (!part) return [];

  const rawSegments = part.split(":");
  const segments = [];

  for (let i = 0; i < rawSegments.length; i += 1) {
    const segment = rawSegments[i];

    if (!segment) {
      throw new Error("Invalid IPv6 address");
    }

    if (segment.includes(".")) {
      if (i !== rawSegments.length - 1 || net.isIP(segment) !== 4) {
        throw new Error("Invalid IPv6 address");
      }

      const ipv4Long = ipv4ToLong(segment);
      segments.push(Math.floor(ipv4Long / 65536).toString(16));
      segments.push((ipv4Long % 65536).toString(16));
    } else {
      if (!/^[0-9a-f]{1,4}$/i.test(segment)) {
        throw new Error("Invalid IPv6 address");
      }

      segments.push(segment);
    }
  }

  return segments.map((segment) => parseInt(segment, 16));
}

function parseIpv6ToBigInt(ip) {
  if (net.isIP(ip) !== 6) {
    throw new Error("Invalid IPv6 address");
  }

  const cleanIp = ip.toLowerCase().split("%")[0];
  const parts = cleanIp.split("::");

  if (parts.length > 2) {
    throw new Error("Invalid IPv6 address");
  }

  const left = parseIpv6Part(parts[0]);
  const right = parts.length === 2 ? parseIpv6Part(parts[1]) : [];

  let groups;

  if (parts.length === 1) {
    if (left.length !== 8) {
      throw new Error("Invalid IPv6 address");
    }

    groups = left;
  } else {
    const missing = 8 - left.length - right.length;

    if (missing < 1) {
      throw new Error("Invalid IPv6 address");
    }

    groups = [...left, ...Array(missing).fill(0), ...right];
  }

  if (groups.length !== 8) {
    throw new Error("Invalid IPv6 address");
  }

  return groups.reduce((acc, group) => (acc << 16n) + BigInt(group), 0n);
}

function isIpv6InCidr(ipBigInt, baseBigInt, prefixLength) {
  const shift = 128n - BigInt(prefixLength);
  return (ipBigInt >> shift) === (baseBigInt >> shift);
}

const REQUIRED_PUBLIC_IPV6_RANGE = [parseIpv6ToBigInt("2000::"), 3];

const BLOCKED_IPV6_CIDRS = [
  ["::", 128],
  ["::1", 128],
  ["::", 96],
  ["::ffff:0:0", 96],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
].map(([base, prefix]) => [parseIpv6ToBigInt(base), prefix]);

function isPublicIpv6(ip) {
  const ipBigInt = parseIpv6ToBigInt(ip);

  if (
    !isIpv6InCidr(
      ipBigInt,
      REQUIRED_PUBLIC_IPV6_RANGE[0],
      REQUIRED_PUBLIC_IPV6_RANGE[1]
    )
  ) {
    return false;
  }

  return !BLOCKED_IPV6_CIDRS.some(([baseBigInt, prefix]) =>
    isIpv6InCidr(ipBigInt, baseBigInt, prefix)
  );
}

function isPublicIp(ip) {
  const cleanIp = stripBrackets(String(ip)).split("%")[0];
  const family = net.isIP(cleanIp);

  if (family === 4) return isPublicIpv4(cleanIp);
  if (family === 6) return isPublicIpv6(cleanIp);

  return false;
}

function parseAndValidateUrl(rawUrl) {
  if (typeof rawUrl !== "string" || rawUrl.trim().length === 0) {
    throw new FetchError("A URL string is required");
  }

  if (rawUrl.length > 2048) {
    throw new FetchError("URL is too long");
  }

  let url;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new FetchError("Invalid URL");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new FetchError("Only http and https URLs are allowed");
  }

  if (url.username || url.password) {
    throw new FetchError("URLs with embedded credentials are not allowed");
  }

  const hostname = stripBrackets(url.hostname);

  if (!hostname) {
    throw new FetchError("URL hostname is required");
  }

  if (
    hostname.toLowerCase() === "localhost" ||
    hostname.toLowerCase().endsWith(".localhost")
  ) {
    throw new FetchError("Localhost URLs are not allowed");
  }

  const effectivePort = url.port || (url.protocol === "https:" ? "443" : "80");

  if (
    (url.protocol === "http:" && effectivePort !== "80") ||
    (url.protocol === "https:" && effectivePort !== "443")
  ) {
    throw new FetchError("Only standard HTTP/HTTPS ports are allowed");
  }

  url.hash = "";

  return url;
}

async function resolveSafeAddress(url) {
  const hostname = stripBrackets(url.hostname);
  const ipFamily = net.isIP(hostname);

  if (ipFamily) {
    if (!isPublicIp(hostname)) {
      throw new FetchError("Private, local, or reserved IP addresses are not allowed");
    }

    return {
      address: hostname,
      family: ipFamily,
    };
  }

  let answers;

  try {
    answers = await dns.lookup(hostname, {
      all: true,
      verbatim: true,
    });
  } catch {
    throw new FetchError("Unable to resolve hostname");
  }

  if (!answers.length) {
    throw new FetchError("Unable to resolve hostname");
  }

  for (const answer of answers) {
    if (!isPublicIp(answer.address)) {
      throw new FetchError(
        "Hostnames resolving to private, local, or reserved IP addresses are not allowed"
      );
    }
  }

  return answers[0];
}

function requestOnce(url) {
  return new Promise(async (resolve, reject) => {
    let resolvedAddress;

    try {
      resolvedAddress = await resolveSafeAddress(url);
    } catch (err) {
      reject(err);
      return;
    }

    const isHttps = url.protocol === "https:";
    const transport = isHttps ? https : http;
    const hostname = stripBrackets(url.hostname);

    const options = {
      protocol: url.protocol,
      hostname,
      port: url.port || (isHttps ? 443 : 80),
      method: "GET",
      path: `${url.pathname}${url.search}`,
      headers: {
        Host: url.host,
        "User-Agent": USER_AGENT,
        Accept: "*/*",
      },
      lookup: (_hostname, opts, cb) => {
        if (typeof opts === "function") {
          cb = opts;
        }

        cb(null, resolvedAddress.address, resolvedAddress.family);
      },
    };

    if (isHttps && net.isIP(hostname) === 0) {
      options.servername = hostname;
    }

    const upstreamReq = transport.request(options, (upstreamRes) => {
      const chunks = [];
      let totalBytes = 0;

      upstreamRes.on("data", (chunk) => {
        totalBytes += chunk.length;

        if (totalBytes > MAX_RESPONSE_BYTES) {
          upstreamReq.destroy(new FetchError("Upstream response is too large", 502));
          upstreamRes.destroy();
          return;
        }

        chunks.push(chunk);
      });

      upstreamRes.on("end", () => {
        resolve({
          statusCode: upstreamRes.statusCode || 502,
          headers: upstreamRes.headers,
          body: Buffer.concat(chunks),
        });
      });

      upstreamRes.on("error", (err) => {
        reject(new FetchError(`Error reading upstream response: ${err.message}`, 502));
      });
    });

    upstreamReq.setTimeout(REQUEST_TIMEOUT_MS, () => {
      upstreamReq.destroy(new FetchError("Upstream request timed out", 504));
    });

    upstreamReq.on("error", (err) => {
      if (err instanceof FetchError) {
        reject(err);
      } else {
        reject(new FetchError(`Upstream request failed: ${err.message}`, 502));
      }
    });

    upstreamReq.end();
  });
}

async function fetchSafely(rawUrl) {
  let currentUrl = parseAndValidateUrl(rawUrl);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const response = await requestOnce(currentUrl);

    if (!REDIRECT_STATUSES.has(response.statusCode)) {
      return response;
    }

    const locationHeader = Array.isArray(response.headers.location)
      ? response.headers.location[0]
      : response.headers.location;

    if (!locationHeader) {
      return response;
    }

    if (redirectCount === MAX_REDIRECTS) {
      throw new FetchError("Too many redirects", 502);
    }

    currentUrl = parseAndValidateUrl(new URL(locationHeader, currentUrl).toString());
  }

  throw new FetchError("Too many redirects", 502);
}

function copySafeHeaders(upstreamHeaders, res) {
  const allowedHeaders = [
    "content-type",
    "content-language",
    "content-encoding",
    "cache-control",
    "expires",
    "last-modified",
    "etag",
  ];

  for (const header of allowedHeaders) {
    const value = upstreamHeaders[header];

    if (value !== undefined) {
      res.setHeader(header, value);
    }
  }
}

app.all("/fetch", async (req, res) => {
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rawUrl = req.method === "GET" ? req.query.url : req.body && req.body.url;

  try {
    const upstreamResponse = await fetchSafely(rawUrl);

    copySafeHeaders(upstreamResponse.headers, res);

    res.status(upstreamResponse.statusCode);
    res.setHeader("Content-Length", upstreamResponse.body.length);
    return res.send(upstreamResponse.body);
  } catch (err) {
    const statusCode = err instanceof FetchError ? err.statusCode : 500;

    return res.status(statusCode).json({
      error: err.message || "Unable to fetch URL",
    });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

module.exports = app;