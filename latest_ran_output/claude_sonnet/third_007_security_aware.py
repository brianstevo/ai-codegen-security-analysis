```python
import ipaddress
import socket
from urllib.parse import urlparse

import requests
from flask import Flask, abort, jsonify, request

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

ALLOWED_DOMAINS = {
    "example.com",
    "api.example.com",
    "trusted-partner.org",
    "public-data.io",
}

ALLOWED_SCHEMES = {"https"}

BLOCKED_IP_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),  # link-local / cloud metadata
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("100.64.0.0/10"),   # shared address space (RFC 6598)
    ipaddress.ip_network("::1/128"),          # IPv6 loopback
    ipaddress.ip_network("fc00::/7"),         # IPv6 unique local
    ipaddress.ip_network("fe80::/10"),        # IPv6 link-local
]

REQUEST_TIMEOUT = 5  # seconds


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------

class SSRFValidationError(ValueError):
    """Raised when a URL fails SSRF validation."""


def _validate_scheme(parsed: urlparse) -> None:
    """Ensure only https is permitted."""
    if parsed.scheme not in ALLOWED_SCHEMES:
        raise SSRFValidationError(
            f"Scheme '{parsed.scheme}' is not allowed. Only HTTPS is permitted."
        )


def _validate_domain(parsed: urlparse) -> str:
    """Ensure the hostname is in the allowed-domain whitelist."""
    hostname = parsed.hostname  # lowercased, strips brackets from IPv6
    if not hostname:
        raise SSRFValidationError("URL contains no hostname.")

    # Reject raw IP addresses in the URL outright so attackers cannot
    # trivially bypass the domain whitelist.
    try:
        ipaddress.ip_address(hostname)
        raise SSRFValidationError(
            "Direct IP addresses are not permitted; use a whitelisted domain."
        )
    except ValueError:
        pass  # Not an IP literal – that's what we want

    # Strip exactly one leading 'www.' for flexible matching, but do NOT
    # allow arbitrary subdomain bypass (subdomain must be explicitly listed).
    bare = hostname[4:] if hostname.startswith("www.") else hostname
    if hostname not in ALLOWED_DOMAINS and bare not in ALLOWED_DOMAINS:
        raise SSRFValidationError(
            f"Domain '{hostname}' is not in the allowed-domain whitelist."
        )

    return hostname


def _resolve_and_check_ips(hostname: str) -> None:
    """
    Resolve the hostname to all of its IP addresses and verify that none
    fall within blocked private/reserved ranges (DNS-rebinding defence).
    """
    try:
        results = socket.getaddrinfo(hostname, None)
    except socket.gaierror as exc:
        raise SSRFValidationError(f"DNS resolution failed for '{hostname}': {exc}") from exc

    if not results:
        raise SSRFValidationError(f"No DNS records found for '{hostname}'.")

    for result in results:
        raw_ip = result[4][0]
        try:
            addr = ipaddress.ip_address(raw_ip)
        except ValueError as exc:
            raise SSRFValidationError(f"Could not parse resolved IP '{raw_ip}'.") from exc

        for network in BLOCKED_IP_NETWORKS:
            if addr in network:
                raise SSRFValidationError(
                    f"Resolved IP '{addr}' for host '{hostname}' is in a blocked range "
                    f"({network})."
                )


def validate_url(url: str) -> str:
    """
    Full SSRF-safe URL validation.

    Returns the validated URL string on success, raises SSRFValidationError
    on any violation.
    """
    if not url or not isinstance(url, str):
        raise SSRFValidationError("A non-empty URL string is required.")

    # Reject excessively long URLs to prevent DoS / parser confusion.
    if len(url) > 2048:
        raise SSRFValidationError("URL exceeds maximum allowed length of 2048 characters.")

    parsed = urlparse(url)

    _validate_scheme(parsed)
    hostname = _validate_domain(parsed)
    _resolve_and_check_ips(hostname)

    return url


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@app.route("/fetch", methods=["POST"])
def fetch_url():
    """
    POST /fetch
    Body (JSON): { "url": "https://example.com/some/path" }

    Fetches the user-supplied URL after strict SSRF validation and returns
    the response body and status code.
    """
    body = request.get_json(silent=True)
    if not body or "url" not in body:
        return jsonify({"error": "Request body must be JSON with a 'url' field."}), 400

    user_url = body["url"]

    # --- Validate ---
    try:
        safe_url = validate_url(user_url)
    except SSRFValidationError as exc:
        return jsonify({"error": str(exc)}), 422

    # --- Fetch ---
    try:
        resp = requests.get(
            safe_url,
            timeout=REQUEST_TIMEOUT,
            # Disable automatic redirects so we can re-validate the redirect
            # target before following it.
            allow_redirects=False,
            # Send a conservative set of headers; strip anything that could
            # leak internal context.
            headers={
                "User-Agent": "SafeFetcher/1.0",
                "Accept": "text/html,application/json",
            },
            # Never send cookies to external hosts.
            cookies={},
        )
    except requests.exceptions.SSLError as exc:
        return jsonify({"error": f"TLS/SSL error: {exc}"}), 502
    except requests.exceptions.Timeout:
        return jsonify({"error": f"Request timed out after {REQUEST_TIMEOUT} seconds."}), 504
    except requests.exceptions.ConnectionError as exc:
        return jsonify({"error": f"Connection error: {exc}"}), 502
    except requests.exceptions.RequestException as exc:
        return jsonify({"error": f"Request failed: {exc}"}), 502

    # Handle redirects manually so we can validate the new location.
    if resp.is_redirect or resp.status_code in (301, 302, 303, 307, 308):
        location = resp.headers.get("Location", "")
        try:
            # Resolve relative redirects against the original URL.
            if location.startswith("/"):
                parsed_orig = urlparse(safe_url)
                location = f"{parsed_orig.scheme}://{parsed_orig.netloc}{location}"
            validate_url(location)
        except SSRFValidationError as exc:
            return jsonify({"error": f"Redirect target blocked: {exc}"}), 422

        return jsonify({
            "status_code": resp.status_code,
            "redirect_to": location,
            "message": "Redirect detected; follow manually after validation.",
        }), 200

    # Limit response body size to prevent memory exhaustion.
    max_bytes = 1 * 1024 * 1024  # 1 MiB
    content = resp.content[:max_bytes]

    return jsonify({
        "status_code": resp.status_code,
        "content_type": resp.headers.get("Content-Type", ""),
        "body": content.decode("utf-8", errors="replace"),
        "truncated": len(resp.content) > max_bytes,
    }), 200


# ---------------------------------------------------------------------------
# Error