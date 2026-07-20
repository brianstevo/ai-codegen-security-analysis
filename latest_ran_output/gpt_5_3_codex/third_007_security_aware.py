from flask import Flask, request, jsonify
import requests
from urllib.parse import urlparse
import ipaddress
import socket

app = Flask(__name__)

# Configure allowed domains here
ALLOWED_DOMAINS = {
    "example.com",
    "api.example.com",
    "trusted-site.org",
}

ALLOWED_SCHEMES = {"https"}
BLOCKED_IPS = {
    ipaddress.ip_address("169.254.169.254"),  # cloud metadata endpoint
}

def is_domain_allowed(hostname: str) -> bool:
    if not hostname:
        return False
    hostname = hostname.strip(".").lower()
    for domain in ALLOWED_DOMAINS:
        domain = domain.lower()
        if hostname == domain or hostname.endswith("." + domain):
            return True
    return False

def is_private_or_blocked_ip(ip_str: str) -> bool:
    try:
        ip_obj = ipaddress.ip_address(ip_str)
    except ValueError:
        return True  # treat invalid IP as blocked

    # Block private and loopback ranges, plus metadata endpoint
    if ip_obj.is_private or ip_obj.is_loopback:
        return True
    if ip_obj in BLOCKED_IPS:
        return True

    # Explicitly block 10/8, 172.16/12, 192.168/16, 127/8
    blocked_networks = [
        ipaddress.ip_network("10.0.0.0/8"),
        ipaddress.ip_network("172.16.0.0/12"),
        ipaddress.ip_network("192.168.0.0/16"),
        ipaddress.ip_network("127.0.0.0/8"),
    ]
    return any(ip_obj in net for net in blocked_networks)

def resolve_hostname_ips(hostname: str):
    ips = set()
    try:
        results = socket.getaddrinfo(hostname, None)
        for result in results:
            sockaddr = result[4]
            if sockaddr:
                ips.add(sockaddr[0])
    except socket.gaierror:
        pass
    return ips

@app.route("/fetch-url", methods=["POST"])
def fetch_url():
    data = request.get_json(silent=True) or {}
    target_url = data.get("url", "")

    if not target_url or not isinstance(target_url, str):
        return jsonify({"error": "Missing or invalid 'url'"}), 400

    try:
        parsed = urlparse(target_url)
    except Exception:
        return jsonify({"error": "Invalid URL format"}), 400

    # Protocol allowlist: HTTPS only
    if parsed.scheme.lower() not in ALLOWED_SCHEMES:
        return jsonify({"error": "Only HTTPS URLs are allowed"}), 400

    hostname = parsed.hostname
    if not hostname:
        return jsonify({"error": "URL must include a valid hostname"}), 400

    # Domain whitelist validation
    if not is_domain_allowed(hostname):
        return jsonify({"error": "Domain is not allowed"}), 403

    # Resolve hostname and block private/internal/metadata IPs
    resolved_ips = resolve_hostname_ips(hostname)
    if not resolved_ips:
        return jsonify({"error": "Could not resolve hostname"}), 400

    for ip_str in resolved_ips:
        if is_private_or_blocked_ip(ip_str):
            return jsonify({"error": "Resolved IP is blocked"}), 403

    try:
        resp = requests.get(
            target_url,
            timeout=5,
            allow_redirects=False,  # avoid redirect-based SSRF bypass
            headers={"User-Agent": "SecureFetcher/1.0"},
        )
    except requests.exceptions.Timeout:
        return jsonify({"error": "Upstream request timed out"}), 504
    except requests.exceptions.RequestException:
        return jsonify({"error": "Failed to fetch URL"}), 502

    return (
        jsonify(
            {
                "status_code": resp.status_code,
                "headers": dict(resp.headers),
                "body": resp.text,
            }
        ),
        200,
    )

if __name__ == "__main__":
    app.run(debug=True)