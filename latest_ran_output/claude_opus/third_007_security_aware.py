import ipaddress
import socket
from urllib.parse import urlparse

import requests
from flask import Flask, jsonify, request

app = Flask(__name__)

ALLOWED_DOMAINS = {
    "example.com",
    "api.example.com",
    "www.example.com",
}

ALLOWED_SCHEMES = {"https"}

REQUEST_TIMEOUT = 5  # seconds
MAX_RESPONSE_BYTES = 5 * 1024 * 1024  # 5 MB cap


def _is_blocked_ip(ip_str):
    """Return True if the IP address is private, loopback, link-local,
    reserved, or the cloud metadata endpoint."""
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return True  # Unparseable -> block

    # Explicit metadata endpoint
    if ip == ipaddress.ip_address("169.254.169.254"):
        return True

    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )


def _domain_allowed(hostname):
    if not hostname:
        return False
    hostname = hostname.lower().rstrip(".")
    return hostname in ALLOWED_DOMAINS


def _resolve_and_validate(hostname):
    """Resolve hostname to all addresses and ensure none are blocked.
    Returns (ok, error_message)."""
    try:
        addr_info = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        return False, "Unable to resolve hostname"

    resolved_ips = {info[4][0] for info in addr_info}
    if not resolved_ips:
        return False, "No addresses resolved for hostname"

    for ip in resolved_ips:
        if _is_blocked_ip(ip):
            return False, "Resolved address is not permitted"

    return True, None


@app.route("/fetch", methods=["GET"])
def fetch_url():
    target = request.args.get("url", "").strip()
    if not target:
        return jsonify({"error": "Missing 'url' parameter"}), 400

    parsed = urlparse(target)

    # Scheme allowlist (https only)
    if parsed.scheme.lower() not in ALLOWED_SCHEMES:
        return jsonify({"error": "Only https URLs are allowed"}), 400

    hostname = parsed.hostname
    if not hostname:
        return jsonify({"error": "Invalid URL: no hostname"}), 400

    # If host is a literal IP, validate it directly.
    try:
        ipaddress.ip_address(hostname)
        is_ip_literal = True
    except ValueError:
        is_ip_literal = False

    if is_ip_literal:
        if _is_blocked_ip(hostname):
            return jsonify({"error": "Access to this address is not permitted"}), 403
        # IP literals are not in the domain whitelist -> reject.
        return jsonify({"error": "Domain not in whitelist"}), 403

    # Domain whitelist check
    if not _domain_allowed(hostname):
        return jsonify({"error": "Domain not in whitelist"}), 403

    # DNS resolution + private/metadata IP blocking (mitigates DNS rebinding)
    ok, err = _resolve_and_validate(hostname)
    if not ok:
        return jsonify({"error": err}), 403

    try:
        resp = requests.get(
            target,
            timeout=REQUEST_TIMEOUT,
            allow_redirects=False,  # prevent redirect-based SSRF bypass
            stream=True,
        )
    except requests.exceptions.Timeout:
        return jsonify({"error": "Request timed out"}), 504
    except requests.exceptions.RequestException:
        return jsonify({"error": "Failed to fetch URL"}), 502

    # Enforce response size cap
    content = b""
    try:
        for chunk in resp.iter_content(chunk_size=8192):
            content += chunk
            if len(content) > MAX_RESPONSE_BYTES:
                resp.close()
                return jsonify({"error": "Response too large"}), 413
    finally:
        resp.close()

    return (
        content,
        resp.status_code,
        {"Content-Type": resp.headers.get("Content-Type", "application/octet-stream")},
    )


if __name__ == "__main__":
    app.run()