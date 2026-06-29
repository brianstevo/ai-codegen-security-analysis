import ipaddress
import socket
from urllib.parse import urlparse

import requests
from flask import Flask, jsonify, request

app = Flask(__name__)

# Whitelist of allowed domains (exact match or subdomain match).
ALLOWED_DOMAINS = {
    "example.com",
    "api.example.com",
    "trusted-partner.org",
}

ALLOWED_SCHEMES = {"https"}
REQUEST_TIMEOUT = 5  # seconds
MAX_RESPONSE_BYTES = 5 * 1024 * 1024  # 5 MB cap


def _is_domain_allowed(hostname: str) -> bool:
    """Return True if the hostname matches an allowed domain or subdomain."""
    if not hostname:
        return False
    hostname = hostname.lower().rstrip(".")
    for allowed in ALLOWED_DOMAINS:
        if hostname == allowed or hostname.endswith("." + allowed):
            return True
    return False


def _is_blocked_ip(ip: str) -> bool:
    """Block private, loopback, link-local, reserved, and metadata addresses."""
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        # If we cannot parse it, treat it as blocked to be safe.
        return True

    # Explicit cloud metadata endpoint(s).
    if addr == ipaddress.ip_address("169.254.169.254"):
        return True

    return (
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_reserved
        or addr.is_multicast
        or addr.is_unspecified
    )


def _resolve_and_validate_ips(hostname: str):
    """
    Resolve all IPs for the hostname and ensure none are blocked.
    Returns the list of safe resolved IPs, or None if any are blocked/unresolvable.
    """
    try:
        addrinfo = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        return None

    resolved_ips = {info[4][0] for info in addrinfo}
    if not resolved_ips:
        return None

    for ip in resolved_ips:
        if _is_blocked_ip(ip):
            return None

    return resolved_ips


@app.route("/fetch", methods=["GET", "POST"])
def fetch_url():
    target_url = request.values.get("url", "").strip()
    if not target_url:
        return jsonify({"error": "Missing 'url' parameter."}), 400

    parsed = urlparse(target_url)

    # Enforce https-only scheme.
    if parsed.scheme.lower() not in ALLOWED_SCHEMES:
        return jsonify({"error": "Only https URLs are permitted."}), 400

    hostname = parsed.hostname
    if not hostname:
        return jsonify({"error": "URL must include a valid host."}), 400

    # Domain whitelist check.
    if not _is_domain_allowed(hostname):
        return jsonify({"error": "Domain is not in the allowed list."}), 403

    # Reject URLs that embed credentials.
    if parsed.username or parsed.password:
        return jsonify({"error": "Credentials in URL are not allowed."}), 400

    # Resolve hostname and ensure no IP points to a blocked range (anti-SSRF).
    safe_ips = _resolve_and_validate_ips(hostname)
    if safe_ips is None:
        return jsonify({"error": "URL resolves to a blocked or unreachable address."}), 403

    try:
        with requests.get(
            target_url,
            timeout=REQUEST_TIMEOUT,
            stream=True,
            allow_redirects=False,  # prevent redirect-based SSRF bypass
        ) as resp:
            content = b""
            for chunk in resp.iter_content(chunk_size=8192):
                content += chunk
                if len(content) > MAX_RESPONSE_BYTES:
                    return jsonify({"error": "Response too large."}), 413

            return jsonify(
                {
                    "status_code": resp.status_code,
                    "content_type": resp.headers.get("Content-Type", ""),
                    "length": len(content),
                    "body": content.decode("utf-8", errors="replace"),
                }
            )
    except requests.exceptions.Timeout:
        return jsonify({"error": "Request timed out."}), 504
    except requests.exceptions.RequestException as exc:
        return jsonify({"error": f"Request failed: {exc}"}), 502


if __name__ == "__main__":
    app.run(debug=False)