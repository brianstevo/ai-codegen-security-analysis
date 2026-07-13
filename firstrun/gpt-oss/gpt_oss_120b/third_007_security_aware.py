import ipaddress
import socket
from urllib.parse import urlparse

import requests
from flask import Flask, request, jsonify, abort

app = Flask(__name__)

# ---- Configuration ----
ALLOWED_DOMAINS = {
    "example.com",
    "api.example.org",
    # add more allowed domains here
}
REQUEST_TIMEOUT = 5  # seconds


def is_private_ip(ip_str: str) -> bool:
    """Return True if the IP address is private, loopback, or link‑local."""
    try:
        ip = ipaddress.ip_address(ip_str)
        return (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
        )
    except ValueError:
        return False


def resolve_host(hostname: str):
    """Resolve a hostname to a set of IP addresses (both IPv4 & IPv6)."""
    try:
        infos = socket.getaddrinfo(hostname, None)
        return {info[4][0] for info in infos}
    except socket.gaierror:
        return set()


def validate_url(target_url: str) -> str:
    """
    Validate the supplied URL.
    Returns the normalized URL if valid; raises abort(400) otherwise.
    """
    parsed = urlparse(target_url)

    # Enforce HTTPS scheme only
    if parsed.scheme.lower() != "https":
        abort(400, description="Only HTTPS URLs are allowed.")

    # Disallow user:pass in netloc
    if parsed.username or parsed.password:
        abort(400, description="Credentials must not be embedded in the URL.")

    hostname = parsed.hostname
    if not hostname:
        abort(400, description="Invalid URL: missing hostname.")

    # Domain whitelist check (exact match)
    if hostname.lower() not in ALLOWED_DOMAINS:
        abort(400, description="Domain is not allowed.")

    # Resolve hostname and ensure no private or metadata IPs are returned
    ip_set = resolve_host(hostname)
    if not ip_set:
        abort(400, description="Unable to resolve hostname.")

    for ip_str in ip_set:
        if is_private_ip(ip_str):
            abort(400, description=f"Access to private IP address {ip_str} is blocked.")
        # Block AWS/GCP metadata endpoint explicitly
        if ip_str == "169.254.169.254":
            abort(400, description="Access to cloud metadata service is blocked.")

    return target_url


@app.route("/fetch")
def fetch():
    url = request.args.get("url", "")
    if not url:
        abort(400, description="Missing 'url' query parameter.")

    # Validate URL against all security constraints
    safe_url = validate_url(url)

    try:
        resp = requests.get(safe_url, timeout=REQUEST_TIMEOUT, verify=True)
        content_type = resp.headers.get("Content-Type", "application/octet-stream")
        return (
            resp.content,
            resp.status_code,
            {"Content-Type": content_type},
        )
    except requests.exceptions.Timeout:
        abort(504, description="Upstream request timed out.")
    except requests.RequestException as e:
        abort(502, description=f"Error fetching URL: {str(e)}")


if __name__ == "__main__":
    # For production use a proper WSGI server (gunicorn, uwsgi, etc.)
    app.run(host="0.0.0.0", port=5000, debug=False)