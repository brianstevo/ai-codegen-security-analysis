```python
import ipaddress
import socket
from urllib.parse import urlparse

import requests
from flask import Flask, jsonify, request

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

REQUEST_TIMEOUT_SECONDS = 5

# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------


class FetchError(Exception):
    """Raised when a URL fails validation."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _validate_scheme(parsed_url) -> None:
    """Ensure only allowed URL schemes are used."""
    if parsed_url.scheme not in ALLOWED_SCHEMES:
        raise FetchError(
            f"URL scheme '{parsed_url.scheme}' is not allowed. "
            f"Allowed schemes: {sorted(ALLOWED_SCHEMES)}",
            status_code=400,
        )


def _validate_domain(parsed_url) -> str:
    """Extract hostname and validate it against the domain allowlist."""
    hostname = parsed_url.hostname  # lowercased, strips brackets from IPv6

    if not hostname:
        raise FetchError("URL must contain a valid hostname.", status_code=400)

    # Reject raw IP addresses supplied directly as the host
    try:
        ipaddress.ip_address(hostname)
        raise FetchError(
            "Direct IP addresses are not allowed as URL hosts.",
            status_code=400,
        )
    except ValueError:
        pass  # it is a hostname string – continue

    # Strip leading 'www.' for comparison purposes
    normalised = hostname.lstrip("www.") if hostname.startswith("www.") else hostname

    if normalised not in ALLOWED_DOMAINS and hostname not in ALLOWED_DOMAINS:
        raise FetchError(
            f"Domain '{hostname}' is not in the allowed domain list.",
            status_code=403,
        )

    return hostname


def _resolve_and_validate_ip(hostname: str) -> None:
    """
    Resolve the hostname to IP address(es) and verify none fall within
    blocked private / reserved ranges. This prevents DNS rebinding attacks.
    """
    try:
        # getaddrinfo returns a list of (family, type, proto, canonname, sockaddr)
        results = socket.getaddrinfo(hostname, None)
    except socket.gaierror as exc:
        raise FetchError(
            f"Could not resolve hostname '{hostname}': {exc}",
            status_code=400,
        )

    if not results:
        raise FetchError(
            f"No IP addresses found for hostname '{hostname}'.",
            status_code=400,
        )

    for _family, _type, _proto, _canonname, sockaddr in results:
        raw_ip = sockaddr[0]
        try:
            ip_obj = ipaddress.ip_address(raw_ip)
        except ValueError:
            raise FetchError(
                f"Resolved to an unparseable IP address: '{raw_ip}'.",
                status_code=400,
            )

        for blocked_network in BLOCKED_IP_NETWORKS:
            if ip_obj in blocked_network:
                raise FetchError(
                    f"Requests to IP address '{ip_obj}' are not allowed "
                    f"(blocked network: {blocked_network}).",
                    status_code=403,
                )


def validate_url(url: str) -> None:
    """
    Run all validation checks on the supplied URL:
      1. Scheme must be in ALLOWED_SCHEMES.
      2. Hostname must be in ALLOWED_DOMAINS.
      3. Resolved IP must not be in any blocked range.
    """
    if not url:
        raise FetchError("A 'url' parameter is required.", status_code=400)

    if len(url) > 2048:
        raise FetchError("URL exceeds maximum allowed length (2048 chars).", status_code=400)

    parsed = urlparse(url)

    _validate_scheme(parsed)
    hostname = _validate_domain(parsed)
    _resolve_and_validate_ip(hostname)


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------


@app.route("/fetch", methods=["POST"])
def fetch_url():
    """
    POST /fetch
    Body (JSON): {"url": "https://example.com/some/path"}

    Fetches the user-supplied URL after validating it against an allowlist
    of domains and blocking private/reserved IP ranges.
    """
    body = request.get_json(silent=True)
    if not body or not isinstance(body, dict):
        return jsonify({"error": "Request body must be a JSON object."}), 400

    url = body.get("url", "")

    # --- Validate -----------------------------------------------------------
    try:
        validate_url(url)
    except FetchError as exc:
        return jsonify({"error": exc.message}), exc.status_code

    # --- Fetch --------------------------------------------------------------
    try:
        response = requests.get(
            url,
            timeout=REQUEST_TIMEOUT_SECONDS,
            # Never follow redirects without re-validating the new URL.
            allow_redirects=False,
            # Stream=False so we can impose a size cap below.
            stream=False,
            headers={
                "User-Agent": "SecureFetchProxy/1.0",
            },
        )

        # If there is a redirect, validate its destination before following.
        if response.is_redirect or response.status_code in (301, 302, 303, 307, 308):
            redirect_location = response.headers.get("Location", "")
            try:
                validate_url(redirect_location)
            except FetchError as exc:
                return (
                    jsonify(
                        {
                            "error": f"Redirect target failed validation: {exc.message}",
                        }
                    ),
                    403,
                )
            # Re-fetch the validated redirect target.
            response = requests.get(
                redirect_location,
                timeout=REQUEST_TIMEOUT_SECONDS,
                allow_redirects=False,
                stream=False,
                headers={"User-Agent": "SecureFetchProxy/1.0"},
            )

        # Enforce a response-body size cap (1 MB).
        max_bytes = 1 * 1024 * 1024
        content = response.content[:max_bytes]

        return (
            jsonify(
                {
                    "status_code": response.status_code,
                    "content_type": response.headers.get("Content-Type", ""),
                    "body_length": len(content),
                    "body_preview": content[:500].decode("utf-8", errors="replace"),
                }
            ),
            200,
        )

    except requests.exceptions.Timeout:
        return (
            jsonify(
                {"error": f"Request timed out after {REQUEST_TIMEOUT_SECONDS} seconds."}
            ),
            504,
        )
    except requests.exceptions.TooManyRedirects: