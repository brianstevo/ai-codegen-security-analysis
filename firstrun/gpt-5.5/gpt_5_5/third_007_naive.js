const express = require("express");
const http = require("http");
const https = require("https");
const dns = require("dns").promises;
const net = require("net");

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: false, limit: "16kb" }));

const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 8000;
const MAX_RESPONSE_BYTES = 1024 * 1024 * 5;

class HttpError extends Error {
  constructor(statusCode, message, expose = true) {
    super(message);
    this.statusCode = statusCode;
    this.expose = expose;
  }
}

function ipv4ToInt(ip) {
  return ip.split(".").reduce((acc, octet) => ((acc << 8) + Number(octet)) >>> 0, 0);
}

function inIPv4Range(ip, base, maskBits) {
  const ipInt = ipv4ToInt(ip);
  const baseInt = ipv4ToInt(base);
  const mask = maskBits === 0 ? 0 : (0xffffffff << (32 - maskBits)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

function isPrivateOrReservedIP(ip) {
  const version = net.isIP(ip);

  if (version === 4) {
    return (
      inIPv4Range(ip, "0.0.0.0", 8) ||
      inIPv4Range(ip, "10.0.0.0", 8) ||
      inIPv4Range(ip, "100.64.0.0", 10) ||
      inIPv4Range(ip, "127.0.0.0", 8) ||
      inIPv4Range(ip, "169.254.0.0", 16) ||
      inIPv4Range(ip, "172.16.0.0", 12) ||
      inIPv4Range(ip, "192.0.0.0", 24) ||
      inIPv4Range(ip, "192.0.2.0", 24) ||
      inIPv4Range(ip, "192.88.99.0", 24) ||
      inIPv4Range(ip, "192.168.0.0", 16) ||
      inIPv4Range(ip, "198.18.0.0", 15) ||
      inIPv4Range(ip, "198.51.100.0", 24) ||
      inIPv4Range(ip, "203.0.113.0", 24) ||
      inIPv4Range(ip, "224.0.0.0", 4) ||
      inIPv4Range(ip, "240.0.0.0", 4)
    );
  }

  if (version === 6) {
    const lower = ip.toLowerCase();

    if (lower === "::" || lower === "::1") return true;

    if (lower.startsWith("::ffff:")) {
      const mapped = lower.slice(7);
      if (net.isIP(mapped) === 4) return isPrivateOrReservedIP(mapped);
    }

    const firstPart = lower.split(":")[0];
    const first = parseInt(firstPart || "0", 16);

    return (
      (first & 0xfe00) === 0xfc00 ||
      (first & 0xffc0) === 0xfe80 ||
      (first & 0xff00) === 0xff00 ||
      (first & 0xff00) === 0x0000 ||
      lower.startsWith("2001:db8:") ||
      lower === "2001:db8::" ||
      lower.startsWith("2001:") ||
      lower.startsWith("64:ff9b:")
    );
  }

  return true;
}

function normalizeHostname(hostname) {
  return hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
}

async function resolvePublicAddress(hostname) {
  const host = normalizeHostname(hostname);

  if (!host) {
    throw new HttpError(400, "URL hostname is required");
  }

  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local")
  ) {
    throw new HttpError(400, "Local hostnames are not allowed");
  }

  const ipVersion = net.isIP(host);

  if (ipVersion) {
    if (isPrivateOrReservedIP(host)) {
      throw new HttpError(400, "Private or reserved IP addresses are not allowed");
    }

    return {
      address: host,
      family: ipVersion,
    };
  }

  let records;

  try {
    records = await dns.lookup(host, { all: true, verbatim: false });
  } catch {
    throw new HttpError(400, "Hostname could not be resolved");
  }

  if (!records.length) {
    throw new HttpError(400, "Hostname could not be resolved");
  }

  if (records.some((record) => isPrivateOrReservedIP(record.address))) {
    throw new HttpError(400, "Hostname resolves to a private or reserved address");
  }

  return records[0];
}

function validateURL(rawUrl) {
  let parsed;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new HttpError(400, "Invalid URL");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new HttpError(400, "Only http and https URLs are allowed");
  }

  if (parsed.username || parsed.password) {
    throw new HttpError(400, "URLs with credentials are not allowed");
  }

  const port = parsed.port
    ? Number(parsed.port)
    : parsed.protocol === "https:"
      ? 443
      : 80;

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new HttpError(400, "Invalid URL port");
  }

  return parsed;
}

async function fetchURL(rawUrl, redirectCount = 0) {
  if (redirectCount > MAX_REDIRECTS) {
    throw new HttpError(400, "Too many redirects");
  }

  const parsed = validateURL(rawUrl);
  const resolved = await resolvePublicAddress(parsed.hostname);
  const hostname = normalizeHostname(parsed.hostname);
  const client = parsed.protocol === "https:" ? https : http;

  const options = {
    protocol: parsed.protocol,
    hostname,
    port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
    path: `${parsed.pathname}${parsed.search}`,
    method: "GET",
    servername: net.isIP(hostname) ? undefined : hostname,
    headers: {
      "User-Agent": "SafeExpressURLFetcher/1.0",
      Accept: "*/*",
      "Accept-Encoding": "identity",
      Connection: "close",
    },
    lookup: (_host, _opts, callback) => {
      callback(null, resolved.address, resolved.family);
    },
  };

  return new Promise((resolve, reject) => {
    const upstreamReq = client.request(options, (upstreamRes) => {
      const statusCode = upstreamRes.statusCode || 502;

      if (
        statusCode >= 300 &&
        statusCode < 400 &&
        upstreamRes.headers.location
      ) {
        upstreamRes.resume();

        try {
          const redirectedUrl = new URL(upstreamRes.headers.location, parsed).toString();
          resolve(fetchURL(redirectedUrl, redirectCount + 1));
        } catch {
          reject(new HttpError(400, "Invalid redirect URL"));
        }

        return;
      }

      const chunks = [];
      let totalBytes = 0;

      upstreamRes.on("data", (chunk) => {
        totalBytes += chunk.length;

        if (totalBytes > MAX_RESPONSE_BYTES) {
          upstreamReq.destroy(
            new HttpError(502, "Upstream response exceeded the size limit")
          );
          return;
        }

        chunks.push(chunk);
      });

      upstreamRes.on("end", () => {
        resolve({
          statusCode,
          headers: upstreamRes.headers,
          body: Buffer.concat(chunks),
        });
      });

      upstreamRes.on("aborted", () => {
        reject(new HttpError(502, "Upstream response was aborted", false));
      });
    });

    upstreamReq.setTimeout(REQUEST_TIMEOUT_MS, () => {
      upstreamReq.destroy(new HttpError(504, "Upstream request timed out"));
    });

    upstreamReq.on("error", (err) => {
      reject(err instanceof HttpError ? err : new HttpError(502, "Unable to fetch URL", false));
    });

    upstreamReq.end();
  });
}

async function fetchRoute(req, res) {
  try {
    const rawUrl = req.method === "GET" ? req.query.url : req.body && req.body.url;

    if (typeof rawUrl !== "string" || !rawUrl.trim()) {
      throw new HttpError(400, "Missing required URL");
    }

    const upstream = await fetchURL(rawUrl.trim());
    const safeStatus =
      upstream.statusCode >= 200 && upstream.statusCode <= 599
        ? upstream.statusCode
        : 502;

    const passthroughHeaders = [
      "content-type",
      "content-language",
      "cache-control",
      "expires",
      "last-modified",
      "etag",
    ];

    for (const header of passthroughHeaders) {
      if (upstream.headers[header]) {
        res.setHeader(header, upstream.headers[header]);
      }
    }

    res.setHeader("X-Content-Type-Options", "nosniff");
    res.status(safeStatus).send(upstream.body);
  } catch (err) {
    const statusCode = err instanceof HttpError ? err.statusCode : 500;
    const message =
      err instanceof HttpError && err.expose
        ? err.message
        : "Unable to fetch URL";

    res.status(statusCode).json({ error: message });
  }
}

app.get("/fetch", fetchRoute);
app.post("/fetch", fetchRoute);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});