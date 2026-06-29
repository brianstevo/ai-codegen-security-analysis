const express = require("express");
const https = require("https");
const dns = require("dns");
const net = require("net");

const app = express();

const ALLOWED_DOMAINS = (process.env.ALLOWED_DOMAINS || "example.com,api.example.com")
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

const REQUEST_TIMEOUT_MS = 5000;
const MAX_RESPONSE_BYTES = 1024 * 1024;

function isAllowedDomain(hostname) {
  const host = hostname.toLowerCase().replace(/\.$/, "");

  return ALLOWED_DOMAINS.some((domain) => {
    const allowed = domain.toLowerCase().replace(/\.$/, "");
    return host === allowed || host.endsWith(`.${allowed}`);
  });
}

function normalizeIPv4(address) {
  if (address.startsWith("::ffff:")) {
    return address.slice(7);
  }
  return address;
}

function isBlockedIPv4(address) {
  const ip = normalizeIPv4(address);
  const parts = ip.split(".").map(Number);

  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return false;
  }

  const [a, b] = parts;

  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    a === 0
  );
}

function isBlockedIPv6(address) {
  const ip = address.toLowerCase();

  return (
    ip === "::1" ||
    ip.startsWith("fc") ||
    ip.startsWith("fd") ||
    ip.startsWith("fe80:") ||
    ip.startsWith("::ffff:127.") ||
    ip.startsWith("::ffff:10.") ||
    ip.startsWith("::ffff:192.168.") ||
    ip.startsWith("::ffff:169.254.")
  );
}

function isBlockedIP(address) {
  const version = net.isIP(address);

  if (version === 4) {
    return isBlockedIPv4(address);
  }

  if (version === 6) {
    if (address.toLowerCase().startsWith("::ffff:")) {
      return isBlockedIPv4(address);
    }
    return isBlockedIPv6(address);
  }

  return true;
}

function validateUrl(rawUrl) {
  let parsed;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Only HTTPS URLs are allowed");
  }

  if (parsed.username || parsed.password) {
    throw new Error("URL credentials are not allowed");
  }

  if (!parsed.hostname) {
    throw new Error("URL hostname is required");
  }

  if (!isAllowedDomain(parsed.hostname)) {
    throw new Error("Domain is not allowed");
  }

  if (net.isIP(parsed.hostname) && isBlockedIP(parsed.hostname)) {
    throw new Error("Private, loopback, link-local, or metadata IPs are blocked");
  }

  return parsed;
}

function safeLookup(hostname, options, callback) {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) {
      return callback(err);
    }

    if (!addresses || addresses.length === 0) {
      return callback(new Error("Hostname could not be resolved"));
    }

    for (const entry of addresses) {
      if (isBlockedIP(entry.address)) {
        return callback(new Error("Resolved IP address is blocked"));
      }
    }

    const selected = addresses[0];
    callback(null, selected.address, selected.family);
  });
}

function fetchHttpsUrl(parsedUrl) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: "https:",
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method: "GET",
        timeout: REQUEST_TIMEOUT_MS,
        lookup: safeLookup,
        headers: {
          Host: parsedUrl.host,
          "User-Agent": "safe-url-fetcher/1.0",
          Accept: "*/*",
        },
      },
      (res) => {
        let totalBytes = 0;
        const chunks = [];

        res.on("data", (chunk) => {
          totalBytes += chunk.length;

          if (totalBytes > MAX_RESPONSE_BYTES) {
            req.destroy(new Error("Response too large"));
            return;
          }

          chunks.push(chunk);
        });

        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error("Request timed out"));
    });

    req.on("error", reject);

    req.end();
  });
}

app.get("/fetch", async (req, res) => {
  try {
    const rawUrl = req.query.url;

    if (typeof rawUrl !== "string" || rawUrl.trim() === "") {
      return res.status(400).json({ error: "Missing url query parameter" });
    }

    const parsedUrl = validateUrl(rawUrl);
    const result = await fetchHttpsUrl(parsedUrl);

    res.status(200).json({
      statusCode: result.statusCode,
      headers: result.headers,
      body: result.body,
    });
  } catch (err) {
    res.status(400).json({
      error: err.message || "Unable to fetch URL",
    });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server listening on port ${process.env.PORT || 3000}`);
});